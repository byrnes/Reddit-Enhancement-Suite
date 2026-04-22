/* @flow */

import { isSafari } from '../utils/browserTarget';
import { sendMessage } from './messaging';

export type PrivateBrowsingState = {|
	value: boolean,
	resolved: boolean,
	source: string,
|};

const safariDebug = (...args) => {
	if (isSafari) {
		console.info('[RES][privateBrowsing]', ...args);
	}
};

function getDirectState(): ?PrivateBrowsingState {
	const extensionContext: any = chrome.extension;
	if (typeof extensionContext?.inIncognitoContext === 'boolean') {
		return {
			value: extensionContext.inIncognitoContext,
			resolved: true,
			source: 'chrome.extension.inIncognitoContext',
		};
	}

	const runtimeContext: any = chrome.runtime;
	if (typeof runtimeContext?.inIncognitoContext === 'boolean') {
		return {
			value: runtimeContext.inIncognitoContext,
			resolved: true,
			source: 'chrome.runtime.inIncognitoContext',
		};
	}
}

function getInitialState(): PrivateBrowsingState {
	return getDirectState() || {
		value: false,
		resolved: false,
		source: isSafari ? 'fallback.unresolved.safari' : 'fallback.unresolved',
	};
}

function getStatePriority({ resolved, source }: PrivateBrowsingState): number {
	let priority = resolved ? 100 : 0;

	if (source === 'chrome.extension.inIncognitoContext' || source === 'chrome.runtime.inIncognitoContext') {
		priority += 30;
	} else if (source === 'context.parent') {
		priority += 20;
	} else if (source === 'background.sender.tab.incognito') {
		priority += 10;
	}

	return priority;
}

let state = getInitialState();

function updateState(nextState: PrivateBrowsingState, reason: string): PrivateBrowsingState {
	if (getStatePriority(nextState) < getStatePriority(state)) {
		return state;
	}

	const changed =
		nextState.value !== state.value ||
		nextState.resolved !== state.resolved ||
		nextState.source !== state.source;

	state = nextState;

	if (changed) {
		safariDebug('State updated', { reason, state });
	}

	return state;
}

function normalizeState(candidate: any, fallbackSource: string): ?PrivateBrowsingState {
	if (typeof candidate?.value !== 'boolean') return;

	return {
		value: candidate.value,
		resolved: candidate.resolved !== false,
		source: typeof candidate.source === 'string' && candidate.source ?
			candidate.source :
			fallbackSource,
	};
}

const resolutionPromise = state.resolved ?
	Promise.resolve(state) :
	sendMessage('privateBrowsing', undefined)
		.then(response => {
			const nextState = normalizeState(response, 'background.privateBrowsing');
			if (nextState) updateState(nextState, 'background');
			return getPrivateBrowsingState();
		})
		.catch(error => {
			safariDebug('State resolution failed', error);
			return getPrivateBrowsingState();
		});

export function isPrivateBrowsing(): boolean {
	return state.value;
}

export function getPrivateBrowsingState(): PrivateBrowsingState {
	return { ...state };
}

export function resolvePrivateBrowsingState(): Promise<PrivateBrowsingState> {
	return resolutionPromise;
}

export function seedPrivateBrowsingState(candidate: {| value: boolean, resolved?: boolean, source?: string |}): PrivateBrowsingState {
	return updateState({
		value: candidate.value,
		resolved: candidate.resolved !== false,
		source: candidate.source || 'context.parent',
	}, 'seed');
}
