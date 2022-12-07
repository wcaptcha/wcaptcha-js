import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import terser from '@rollup/plugin-terser';

const TERSER_CONFIG = {
	output: {
		comments: false,
	}
}

const getBundleConfig = (minified) => ({
	input: './wcaptcha.js',
	output: [
		{
			name: 'wcaptcha',
			file: `./dist/wcaptcha.umd${minified ? '.min' : ''}.js`,
			format: 'umd'
		},
		{
			name: 'wcaptcha',
			file: `./dist/wcaptcha.esm${minified ? '.min' : ''}.js`,
			format: 'es'
		}
	],
	plugins: [
		resolve(),
		commonjs(),
		...(minified ? [terser(TERSER_CONFIG)] : []),
	],
})


export default [
	getBundleConfig(false),
	getBundleConfig(true),
]

