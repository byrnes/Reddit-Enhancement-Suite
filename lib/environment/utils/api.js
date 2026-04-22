/* @flow */

export function apiToPromise(
	func: (...args: mixed[]) => void,
	thisArg?: mixed,
): (...args: mixed[]) => Promise<any> {
	return (...args) =>
		new Promise((resolve, reject) => {
			Reflect.apply(func, thisArg, [...args, (...results) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
				} else {
					resolve(results.length > 1 ? results : results[0]);
				}
			}]);
		});
}
