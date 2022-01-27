import { put, takeLatest, all } from 'redux-saga/effects';
import RNBootSplash from 'react-native-bootsplash';

import codePush from 'react-native-code-push';
import UserPreferences from '../lib/userPreferences';
import { selectServerRequest, serverRequest } from '../actions/server';
import { setAllPreferences } from '../actions/sortPreferences';
import { APP } from '../actions/actionsTypes';
import RocketChat from '../lib/rocketchat';
import log from '../utils/log';
import database from '../lib/database';
import { localAuthenticate } from '../utils/localAuthentication';
import { ROOT_OUTSIDE, appReady, appStart } from '../actions/app';

import appConfig from '../../app.json';

export const initLocalSettings = function* initLocalSettings() {
	const sortPreferences = yield RocketChat.getSortPreferences();
	yield put(setAllPreferences(sortPreferences));
};

const restore = function* restore() {
	try {
		// const server = yield UserPreferences.getStringAsync(RocketChat.CURRENT_SERVER);
		// let userId = yield UserPreferences.getStringAsync(`${RocketChat.TOKEN_KEY}-${server}`);

		// if (!server) {
		// 	yield put(appStart({ root: ROOT_OUTSIDE }));
		// } else if (!userId) {
		// 	const serversDB = database.servers;
		// 	const serversCollection = serversDB.get('servers');
		// 	const servers = yield serversCollection.query().fetch();

		// 	// Check if there're other logged in servers and picks first one
		// 	if (servers.length > 0) {
		// 		for (let i = 0; i < servers.length; i += 1) {
		// 			const newServer = servers[i].id;
		// 			userId = yield UserPreferences.getStringAsync(`${RocketChat.TOKEN_KEY}-${newServer}`);
		// 			if (userId) {
		// 				return yield put(selectServerRequest(newServer));
		// 			}
		// 		}
		// 	}
		const { server } = appConfig;
		const userId = yield UserPreferences.getStringAsync(`${RocketChat.TOKEN_KEY}-${server}`);

		if (!userId) {
			yield all([UserPreferences.removeItem(RocketChat.TOKEN_KEY), UserPreferences.removeItem(RocketChat.CURRENT_SERVER)]);
			yield put(serverRequest(appConfig.server));
			yield put(appStart({ root: ROOT_OUTSIDE }));
		} else {
			const serversDB = database.servers;
			const serverCollections = serversDB.get('servers');

			let serverObj;
			try {
				yield localAuthenticate(server);
				serverObj = yield serverCollections.find(server);
			} catch {
				// Server not found
			}
			yield put(selectServerRequest(server, serverObj && serverObj.version));
		}

		yield put(appReady({}));
	} catch (e) {
		log(e);
		yield put(appStart({ root: ROOT_OUTSIDE }));
	}
};

const start = function* start() {
	yield RNBootSplash.hide();
};

const root = function* root() {
	yield takeLatest(APP.INIT, restore);
	yield takeLatest(APP.START, start);
	yield takeLatest(APP.INIT_LOCAL_SETTINGS, initLocalSettings);
	// ROXLABS OTA
	let channel = appConfig.activeChannel;
	let otaKey = appConfig.stagingKey;
	if (channel !== 'prod' || channel == null) {
		channel = 'stage';
	}
	if (channel === 'prod') {
		otaKey = appConfig.productionKey;
	}
	codePush.sync({ deploymentKey: otaKey });
	// Download the update silently, but install it on
	// the next resume, as long as at least 5 minutes
	// has passed since the app was put into the background.
	codePush.sync({ installMode: codePush.InstallMode.ON_NEXT_RESUME, minimumBackgroundDuration: 60 * 5 });

	// Download the update silently, and install optional updates
	// on the next restart, but install mandatory updates on the next resume.
	codePush.sync({ mandatoryInstallMode: codePush.InstallMode.ON_NEXT_RESUME });

	// Changing the title displayed in the
	// confirmation dialog of an "active" update
	codePush.sync({ updateDialog: { title: 'An update is available!' } });

	// Displaying an update prompt which includes the
	// description for the CodePush release
	codePush.sync({
		updateDialog: {
			appendReleaseDescription: true,
			descriptionPrefix: '\n\nChange log:\n'
		},
		installMode: codePush.InstallMode.IMMEDIATE
	});
};
export default root;
