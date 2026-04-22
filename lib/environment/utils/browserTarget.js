/* @flow */

const BUILD_TARGET = process.env.BUILD_TARGET;

export const isFirefox = BUILD_TARGET === 'firefox';
export const isSafari = BUILD_TARGET === 'safari';
