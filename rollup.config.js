import typescript from 'rollup-plugin-typescript2';
import hashbang from 'rollup-plugin-hashbang';
import executable from 'rollup-plugin-executable';
import commonjs from 'rollup-plugin-commonjs';
import multiInput from 'rollup-plugin-multi-input';

import pkg from './package.json';

const common = {
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]
};

const commonPlugins = [
    typescript({
        typescript: require('typescript')
    })
];

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: pkg.main,
                format: 'cjs'
            },
            {
                file: pkg.module,
                format: 'es'
            }
        ],
        external: ['src/migrations/**'],

        plugins: [
            ...commonPlugins
            // del({ targets: 'dist/migrations/**' })
        ],
        ...common
    },
    {
        input: 'src/bin.ts',
        output: {
            dir: 'dist',
            format: 'cjs'
        },
        plugins: [
            commonjs({
                ignore: ['conditional-runtime-dependency'],
                namedExports: {
                    'node_modules/yargs/yargs.js': ['Yargs']
                }
            }),
            hashbang(),
            executable(),
            ...commonPlugins
        ],
        ...common
    },
    {
        input: ['src/migrations/**/*.ts'],
        output: [
            {
                dir: 'dist',
                format: 'cjs'
            }
        ],
        plugins: [multiInput(), ...commonPlugins],
        ...common
    }
];
