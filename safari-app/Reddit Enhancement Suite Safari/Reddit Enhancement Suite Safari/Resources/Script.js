/* @noflow */
/* global webkit:readonly */

function setText(className, text) {
	document.getElementsByClassName(className)[0].textContent = text;
}

window.show = (enabled, useSettingsInsteadOfPreferences) => {
	if (useSettingsInsteadOfPreferences) {
		setText('state-on', 'Reddit Enhancement Suite Safari’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.');
		setText('state-off', 'Reddit Enhancement Suite Safari’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.');
		setText('state-unknown', 'You can turn on Reddit Enhancement Suite Safari’s extension in the Extensions section of Safari Settings.');
		setText('open-preferences', 'Quit and Open Safari Settings…');
	}

	if (typeof enabled === 'boolean') {
		document.body.classList.toggle('state-on', enabled);
		document.body.classList.toggle('state-off', !enabled);
	} else {
		document.body.classList.remove('state-on');
		document.body.classList.remove('state-off');
	}
};

function openPreferences() {
	webkit.messageHandlers.controller.postMessage('open-preferences');
}

document.querySelector('button.open-preferences').addEventListener('click', openPreferences);
