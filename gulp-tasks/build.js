const gulp = require('gulp');
const gulpif = require('gulp-if');

// debugging
const plumber = require('gulp-plumber');

// css
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const concatCss = require('gulp-concat-css');

// javascript
const rollupJson = require('rollup-plugin-json');
const rollup = require('gulp-better-rollup');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const ts = require('rollup-plugin-typescript2');
const rename = require('gulp-rename');

//minifier
const terser = require('gulp-terser');

const fs = require('fs');

const argv = require('minimist')(process.argv.slice(2));

const minifier = argv['minifier'];

const slash = process.platform === 'win32' ? '\\' : '/';

function build() {
    const path = findDeepDir();
    let customerDir = '.' + slash;

    if (argv['customer-id']) {
        customerDir = findDir('.' + slash, argv['customer-id'], 'Customer Id');
    } 

    let buildPath = customerDir + '_built' + slash + argv['sitecode'] + slash;

    if (argv['experiment-id'] || argv['personalization-id'] || argv['variation-id'] || argv['common'] || argv['targeting']) {
        if (argv['experiment-id']) {
            buildPath += 'experiments' + slash;
            buildPath += argv['experiment-id'] + slash;
        } else {
            buildPath += 'personalizations' + slash;
            buildPath += argv['personalization-id'] + slash;
        }
    }

    if (argv['variation-id']) {
        buildFiles(findFiles(path, argv['variation-id']), buildPath);
    }

    else if (argv['common']) {
        buildFiles(findFiles(path, 'common.'), buildPath);
    }

    else if (argv['targeting']) {
        buildFiles(findFiles(path, 'targeting.'), buildPath);
    }

    else if ((argv['experiment-id'] || argv['personalization-id']) && !argv['variation-id'] && !argv['common'] && !argv['targeting']) {
        buildFiles(findFiles(path, /^[0-9]+/g), buildPath);
        buildFiles(findFiles(path, 'common.'), buildPath);
        buildFiles(findFiles(path, 'targeting.'), buildPath);
    }

    else if (argv['global']) {
        buildPath += 'global' + slash;
        buildFiles(findFiles(path, 'index.'), buildPath);
    }

    return gulp.src('.', {allowEmpty: true});
}

function findFiles(base, contains) {
    const file = fs.readdirSync(base).filter((file) => {
        if (file.match(contains)) {
            return true;
        }
        return false;
    });
    if (file.length > 0) {
        return file.map(file => {
            return {
                path: base,
                name: file,
                nameWithoutExt: file.match(contains)[0].toString().replace('.', '')
            };
        });
    }
    return [];
}

function findDir(base, contains, errorString) {
    const file = fs.readdirSync(base).find((file) => {
        if (file.match(contains)) {
            return true;
        }
        return false;
    });
    if (file) {
        return file + slash;
    } else {
        throw new Error(`No directory found for ${errorString}: ${contains}`);
    }
}

function findDeepDir() {
    let path = '.' + slash;
    if (argv['customer-id']) {
        path += findDir(path, argv['customer-id'], 'Customer Id');
    }
    path += findDir(path, argv['sitecode'], 'Site code');
    if (argv['experiment-id']) {
        path += findDir(path, 'experiments', 'experiments');
        path += findDir(path, argv['experiment-id'], 'Experiment Id');
    }
    if (argv['personalization-id']) {
        path += findDir(path, 'personalizations', 'personalizations');
        path += findDir(path, argv['personalization-id'], 'Personalization Id');
    }
    if (argv['global']) {
        path += findDir(path, 'global', 'Global');
    }
    return path;
}


function buildFiles(files, buildPath) {
    files.forEach((file) => {
        if (file.name.indexOf('.ts') !== -1) {
            return compileTS(file, buildPath);
        }
        if (file.name.indexOf('.js') !== -1) {
            return compileJS(file, buildPath);
        }
        if (file.name.indexOf('.css') !== -1 || file.name.indexOf('.scss') !== -1) {
            return compileCSS(file, buildPath);
        }
    });
}

function compileTS(file, buildPath) {
    let options = {};
    if (file.name.match("targeting.ts$")) {
        options.errorHandler = (error) => {
            if (error.message.indexOf('A \'return\' statement can only be used within a function body.') === -1) {
                throw new Error(error);
            }
        }
    }
    return gulp.src(file.path + file.name)
        .pipe(plumber(options))
        .pipe(rollup({ plugins: [resolve(), ts({ noEmit: true }), commonjs(), rollupJson()] }, { format: 'iife', output: {extend: true}}))
        .pipe(plumber.stop())
        .pipe(rename(function (path) {
            path.extname = '.js';
            path.basename = file.nameWithoutExt;
            if (process.platform === 'win32') {
                path.dirname = buildPath;
            }
        }))
        .pipe(gulpif(minifier, terser()))
        .pipe(gulp.dest(process.platform === 'win32' ? ('.' + slash) : buildPath));
}

function compileJS(file, buildPath) {
    const outPutParams = {
        format: file.name.match('global') ? 'iife' : 'cjs',
        strict: false
    };
    let options = {};
    if (file.name.match("targeting.js$")) {
        options.errorHandler = (error) => {
            if (error.message.indexOf('\'return\' outside of function') === -1) {
                throw new Error(error);
            }
        }
    }
    return gulp.src(file.path + file.name)
        .pipe(plumber(options))
        .pipe(rollup({ plugins: [resolve(), commonjs(), rollupJson()] }, outPutParams))
        .pipe(plumber.stop())
        .pipe(rename(function (path) {
            path.basename = file.nameWithoutExt;
            if (process.platform === 'win32') {
                path.dirname = buildPath;
            }
        })) 
        .pipe(gulpif(minifier, terser()))
        .pipe(gulp.dest(process.platform === 'win32' ? ('.' + slash) : buildPath));
}

function compileCSS(file, buildPath) {
    return gulp.src(file.path + file.name)
        .pipe(sass().on('error', sass.logError))
        .pipe(autoprefixer({ grid: true, cascade: true }))
        .pipe(concatCss(file.name))
        .pipe(rename(function (path) {
            path.extname = '.css';
            path.basename = file.nameWithoutExt;
        }))
        .pipe(gulp.dest(buildPath));
}

exports.build = build;