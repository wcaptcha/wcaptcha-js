'use strict'

import vdfWorker from './vdfworker.js'
import gmpWasm from './gmp.umd.js'

var wcaptcha = function (api_key) {
    this.apiKey = api_key

    let gmpUrl = URL.createObjectURL(new Blob([`(${gmpWasm.toString()})()`]))
    let workerUrl = URL.createObjectURL(new Blob([`(${vdfWorker.toString()})("${gmpUrl}")`]))

    let worker = new Worker(workerUrl)
    this.worker = worker;
}

wcaptcha.prototype.apiEndpoint = "https://api-wcaptcha.pingflash.com/";
wcaptcha.prototype.worker = null;
wcaptcha.prototype.question = null;

// Bind wCaptcha to a dom element, the element must be a child element in the <form>
wcaptcha.prototype.bind = function(selector) {
    let els = document.querySelectorAll(selector)
    if (els.length == 0) {
        console.warn("wCaptcha is unable to bind, selector selects no dom element")
        return
    }

    let elm = document.createElement("div")

    let elm_info = document.createElement("span")

    let elm_progress = document.createElement("span")
    let elm_input = document.createElement("input")
    elm_input.setAttribute("type", "hidden")
    elm_input.setAttribute("name", "wcaptcha-prove")
    elm_input.setAttribute("value", "")
    

    elm.appendChild(elm_info)
    elm.appendChild(elm_progress)
    elm.appendChild(elm_input)
    
    this.elm = elm
    this.elmProgress = elm_progress
    this.elmInput = elm_input
    this.elmInfo = elm_info

    
    elm.style.padding = "0.5rem"
    elm.style.display = "flex"
    elm.style.justifyContent = "center"
    elm.style.alignItems = "center"
    elm.style.maxWidth = "40em"
    elm.style.height = "4em"

    this.hideUI()
    els[0].appendChild(elm)
    
    let form = null
    let parent = elm.parentElement
    while (parent) {
        if (parent.tagName == "FORM") {
            form = parent;
            break;
        } else {
            parent = parent.parentElement
        }
    }

    if (!form) {
        console.log("Selected element is not in a form")
    } else {
        console.debug("Binding events for form", form)
        let that = this
        form.onsubmit = function(e) {
            e.preventDefault()
            let that2 = that
            that.prove().then( y => {
                that2.elmInput.setAttribute("value", y)
                that2.form.submit()
            })
        }
    }
}



// Caculate a proof
wcaptcha.prototype.prove = function() {
    let that = this
    
    console.log(that.elm)
    console.log(that.elmProgress)

    return new Promise(function(resolve, reject) {
        let worker = that.worker

        let resolver = resolve
        let rejector = reject
        
        worker.onmessage = msg => {
            let d = msg.data;
            if (d[0] == "eval_progress") {
                console.debug("Got VDF calculate progress", d[1])
                that.setProgress(d[1])
            } else if (d[0] == "eval_result") {
                console.debug("Got VDF result", d[1])
                that.setProgress(1)

                // Proof format is X.Y.N
                let proof = [that.question.x, d[1], that.question.h].join(".")
                that.question = null

                resolver(proof)
            } else {
                console.log(d);
            }
        }

        that.setProgress(0)
        that.showUI()

        try {
            that.getProblem().then( r => {
                if (!r) {
                    rejector("Unable to get CAPTCHA question")
                } else {
                    console.log(`Prepare to calculate ${r.x} ** (2 ** ${r.t}) mod ${r.n}`)
                    worker.postMessage(["eval", r.x, r.t, r.n])
                }
            }).catch(e1 => {
                let err = "Unable to verify, may be network issue"
                if (that.elmInfo != undefined)  {
                    that.elmInfo.innerText = err
                    that.elm.style.background = "radial-gradient(#ff1e1e1f, #ff8f8f7d)"
                }
                rejector(`${err}: ${e1}`)
            })
        } catch (e2) {
            rejector(e2)
        }
    });
}

// Get a problem from local cache. If local cache is not exists, fetch a new question from server
wcaptcha.prototype.getProblem = async function() {
    if (this.question) {
        return this.question
    } else {
        await this.fetchProblem()
        return this.question
    }
}

wcaptcha.prototype.setProblem = function(x, t, n, h) {
    this.question = {
        x: x,
        t: t,
        n: n,
        h: h,
    }
}

// Fetch a new problem from server
wcaptcha.prototype.fetchProblem = async function() {
    let j = null
    try {
        let ret = await fetch(this.apiEndpoint + "captcha/problem/get?api_key=" + this.apiKey)
        j = await ret.json()
    } catch (e) {
        console.warn("Unable to get wCaptcha question", e)
        throw e
    }

    if (j.code != 0 ){
        console.warn("Unable to get wCaptcha question, server returns error", j)
        return
    }

    console.debug("Got a new question from server", j.data.question)
    this.question = j.data.question
}

wcaptcha.prototype.setProgress = function(progress) {
    try {
        this.onprogress(progress)
    } catch (e) {
        console.warn("Unable to emit onprogress event", e)
    }

    if (!this.elmProgress) {
        return
    }

    if (progress < 1) {
        this.elm.style.background = "radial-gradient(#c7dae11f, #e7f4f8ed)"
        this.elm.style.border = "1px solid #d8e3e7";
        this.elmInfo.innerText = "Checking if you are a human..."

        let pText = Math.round(progress * 100)
        this.elmProgress.innerText = pText + "%"
    } else {
        this.elm.style.background = "radial-gradient(#c7dae11f, #58ff5b21)";
        this.elm.style.border = "1px solid #9ec99b";
        this.elmInfo.innerHTML = "Verification completed. "

        this.elmProgress.innerHTML = "<b stlye='color: green !important;'>✓</b>"
    }
}

// Call when there is a progress event. progress is between [0, 1]
wcaptcha.prototype.onprogress = function (progress) {}


// Display wCaptcha UI
wcaptcha.prototype.showUI = function () {
    if (!this.elm) {
        console.debug("wCaptcha UI box is not initialized, unable to hide")
        return
    }
    this.elm.style.visibility = "visible";    
}
// Hide wCaptcha UI
wcaptcha.prototype.hideUI = function () {
    if (!this.elm) {
        console.debug("wCaptcha UI box is not initialized, unable to hide")
        return
    }
    this.elm.style.visibility = "hidden";
}


// Set API endpoint. Default is "https://api-wcaptcha.pingflash.com/"
wcaptcha.prototype.setEndpoint = function (endpoint) {
    if (endpoint[endpoint.length - 1] != '/') {
        endpoint += '/'
    }
    this.apiEndpoint = endpoint
}


wcaptcha.prototype.verify_DEVONLY = async function(y) {
    let opts = {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "api_key=" + this.apiKey + "&prove=" + y,
    }
    
    let ret = await fetch(this.apiEndpoint + "captcha/verify", opts)
    let j = await ret.json()
    return j.message
}




export default wcaptcha