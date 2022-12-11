const gulp = require('gulp')
const gulpif = require('gulp-if')

// debugging
const plumber = require('gulp-plumber')

// css
const sass = require('gulp-sass')(require('sass'))
const autoprefixer = require('gulp-autoprefixer')
const concatCss = require('gulp-concat-css')

// javascript
const rollupJson = require('rollup-plugin-json')
const rollup = require('gulp-better-rollup')
const resolve = require('rollup-plugin-node-resolve')
const commonjs = require('rollup-plugin-commonjs')
const ts = require('rollup-plugin-typescript2')
const rename = require('gulp-rename')

//minifier
const terser = require('gulp-terser')

const path = require('path')

const argv = require('minimist')(process.argv.slice(2))

function build() {
	const buildTargetPath = argv['build-target-path']
	const buildOutputPath = argv['build-output-path']

	buildFile(buildTargetPath, buildOutputPath)

	return gulp.src('.', { allowEmpty: true })
}

function buildFile(filePath, buildPath) {
	if (filePath.endsWith('.ts')) return compileTS(filePath, buildPath)

	if (filePath.endsWith('.js')) return compileJS(filePath, buildPath)

	if (filePath.endsWith('.css') || filePath.endsWith('.scss'))
		return compileCSS(filePath, buildPath)
}

function getRelativeBuildPath(absolutePath) {
	const splitBuildPath = absolutePath.split(path.sep)
	const outputPath = splitBuildPath.slice(
		splitBuildPath.indexOf('_build'),
		-1
	)

	return path.join(...outputPath)
}

function compileTS(filePath, buildPath) {
	return gulp
		.src(filePath)
		.pipe(plumber({}))
		.pipe(
			rollup(
				{
					plugins: [
						resolve(),
						ts({ noEmit: true }),
						commonjs(),
						rollupJson(),
					],
				},
				{ format: 'iife', output: { extend: true } }
			)
		)
		.pipe(plumber.stop())
		.pipe(
			rename((path) => {
				path.extname = '.js'
			})
		)
		.pipe(terser())
		.pipe(gulp.dest(getRelativeBuildPath(buildPath)))
}

function compileJS(filePath, buildPath) {
	const outPutParams = {
		format: filePath.match('global') ? 'iife' : 'cjs',
		strict: false,
	}

	return gulp
		.src(filePath)
		.pipe(plumber({}))
		.pipe(
			rollup(
				{ plugins: [resolve(), commonjs(), rollupJson()] },
				outPutParams
			)
		)
		.pipe(plumber.stop())
		.pipe(terser())
		.pipe(gulp.dest(getRelativeBuildPath(buildPath)))
}

function compileCSS(filePath, buildPath) {
	return gulp
		.src(filePath)
		.pipe(sass().on('error', sass.logError))
		.pipe(autoprefixer({ grid: true, cascade: true }))
		.pipe(concatCss(filePath))
		.pipe(
			rename((path) => {
				path.extname = '.css'
				path.dirname = ''
			})
		)
		.pipe(gulp.dest(getRelativeBuildPath(buildPath)))
}

exports.build = build
