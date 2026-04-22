/* @flow */

// load environment listeners
import './environment/background/ajax';
import './environment/background/auth';
import './environment/background/download';
import './environment/background/history';
import './environment/background/i18n';
import './environment/background/loadScript';
import './environment/background/localePersistor';
import { addListener } from './environment/background/messaging';
import './environment/background/multicast';
import './environment/background/pageAction';
import './environment/background/permissions';
import './environment/background/session';
import './environment/background/storage';
import './environment/background/tabs';
import './environment/background/xhrCache';

import { migrate } from './core/migrate';

const safariDebug = (...args) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][background]', ...args);
	}
};

safariDebug('Background service worker started');
const initialMigration = migrate();

initialMigration
	.then(() => { safariDebug('Initial migration completed'); })
	.catch(error => {
		console.error('[RES][background] Initial migration failed', error);
	});

// Restoring a backup may require migrations to be run
addListener('runMigrations', async () => {
	safariDebug('runMigrations requested');
	try {
		await migrate();
		safariDebug('runMigrations completed');
	} catch (error) {
		console.error('[RES][background] runMigrations failed', error);
		throw error;
	}
});
