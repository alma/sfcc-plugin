import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import stylisticJs from '@stylistic/eslint-plugin-js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const compat = new FlatCompat({
    baseDirectory: dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [
    {
        ignores: ['cartridges/int_alma/cartridge/static/', '**/coverage', '**/test']
    },
    ...compat.extends('airbnb-base/legacy'), {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module'
        },
        plugins: {
            '@stylistic/js': stylisticJs
        },
        rules: {
            '@stylistic/js/indent': ['error', 4, {
                SwitchCase: 1,
                VariableDeclarator: 1
            }],
            '@stylistic/js/max-len': 'off',
            // complexity: ['error', 5],
            'func-names': 'off',
            'global-require': 'off', // deprecated if needed, use eslint-plugin-n
            'import/no-unresolved': 'off',
            indent: 'off', // deprecated, use @stylistic/js/indent
            'max-len': 'off', // deprecated, use @stylistic/js/max-len
            'no-compare-neg-zero': 'error',
            'no-console': 'off',
            'no-fallthrough': 'error',
            'no-inner-declarations': 'error',
            'no-param-reassign': 'off',
            'no-shadow': ['error', {
                allow: ['err', 'callback']
            }],
            'no-unused-vars': 'error',
            'no-useless-assignment': 'error',
            'vars-on-top': 'off'
        }
    }];
