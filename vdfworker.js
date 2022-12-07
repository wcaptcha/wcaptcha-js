function vdfworker(_gmpUrl) {

importScripts(_gmpUrl);

console.debug("VDF worker started")

onmessage = async (m) => {
    let d = m.data
    let that = this

    switch (d[0]) {
        case "powm":
            powm(d[1], d[2], d[3])
            break;
        case "eval":
            let stime = (new Date()).getTime();
            
            let ret = d[1]
            let t = d[2]

            let last_progress_time = (new Date()).getTime()

            let chunk_size = 128
            let residual = t % chunk_size
            t -= residual

            ret = await vdfEval(ret, residual, d[3])
            for (let i = 0; i < chunk_size; i++) {
                ret = await vdfEval(ret, t / chunk_size, d[3])

                let ts = (new Date()).getTime()
                if (ts - last_progress_time >= 200) {
                    last_progress_time = ts
                    postMessage(["eval_progress", i / chunk_size])
                }
            }

            console.log("VDF calculated in", (new Date()).getTime() - stime, "ms, result is", ret)

            that.postMessage(["eval_result", ret])
            break;
        default: 
            console.warn("VDF worker receive unknown message", m);
            throw "Unknown message function"

    }
}

// Caculate y = x ** (2 ** t) mod n
async function vdfEval(_x, _t, _n) {
    let ret;
    let {binding, calculate, getContext} = await gmp.init()
    
    let g = getContext()
    let x = g.Integer(0);
    let y = g.Integer(0);
    let n = g.Integer(0);
    
    binding.mpz_init_set_str(x.mpz_t, binding.malloc_cstr(_x), 16)
    binding.mpz_init_set_str(n.mpz_t, binding.malloc_cstr(_n), 16)

    // Calculate s = 2 ** t
    let s = g.Integer(0)
    binding.mpz_pow_ui(s.mpz_t, g.Integer(2).mpz_t, _t)

    // Calculate x ** s mod n
    binding.mpz_powm(y.mpz_t, x.mpz_t, s.mpz_t, n.mpz_t)

    //console.log("Eval y = ", y.toString(16));

    ret = y.toString(16)

    g.destroy()
    
    return ret
}

}

export default vdfworker