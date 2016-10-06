import {
	platform,
	isWinGte8,
	isMountainLion
} from "utils/node/platform";
import ProviderAuto from "./notification/NotificationProviderAuto";
import ProviderToast from "./notification/NotificationProviderToast";
import ProviderNotificationCenter from "./notification/NotificationProviderNotificationCenter";
import ProviderLibNotify from "./notification/NotificationProviderLibNotify";
import ProviderGrowl from "./notification/NotificationProviderGrowl";
import ProviderRich from "./notification/NotificationProviderRich";


const providers = {
	"auto": ProviderAuto,
	"toast": ProviderToast,
	"notificationcenter": ProviderNotificationCenter,
	"libnotify": ProviderLibNotify,
	"growl": ProviderGrowl,
	"rich": ProviderRich
};
const fallbackMap = {};
const instanceCache = {};


/**
 * Check whether a NotificationProvider is supported on the current platform
 * @param {string} provider
 * @returns {boolean}
 */
export function isSupported( provider ) {
	if ( !providers.hasOwnProperty( provider ) ) {
		return false;
	}

	let platforms = providers[ provider ].platforms;
	return platforms.hasOwnProperty( platform )
	    || isWinGte8 && platforms.hasOwnProperty( "win32gte8" )
	    || isMountainLion && platforms.hasOwnProperty( "mountainlion" );
}


/**
 * Get the name of a fallback provider
 * @param {String} provider
 * @returns {String}
 */
function getFallback( provider ) {
	let platforms = providers[ provider ].platforms;
	if ( isWinGte8 && platforms.hasOwnProperty( "win32gte8" ) ) {
		return platforms[ "win32gte8" ];
	}
	if ( isMountainLion && platforms.hasOwnProperty( "mountainlion" ) ) {
		return platforms[ "mountainlion" ];
	}
	return platforms[ platform ] || null;
}


/**
 * Create a notification
 * @param {String} provider
 * @param {Object} data
 * @param {Object?} setupData
 * @returns {Promise}
 */
function notify( provider, data, setupData ) {
	let providerInstance = instanceCache.hasOwnProperty( provider )
		? instanceCache[ provider ]
		: ( instanceCache[ provider ] = new providers[ provider ]( setupData ) );

	data.sound = false;
	data.wait = false;

	return providerInstance.notify( data );
}


/**
 * Tests a NotificationProvider given by name and displays a notification
 * @param {String} provider
 * @param {Object} data
 * @param {Boolean?} noFallback
 * @returns {Promise}
 */
export function show( provider, data, noFallback ) {
	// recursively test provider and its fallbacks
	function testProvider( currentProvider ) {
		// optimization: is a fallback for the current provider already known and set up?
		if ( !noFallback && fallbackMap.hasOwnProperty( currentProvider ) ) {
			// don't test the current provider twice
			return notify( fallbackMap[ currentProvider ], data );
		}

		// test the current provider
		return providers[ currentProvider ].test()
			// current provider is working...
			.then(function( setupData ) {
				// add it to the fallbackMap
				fallbackMap[ provider ] = currentProvider;
				return notify( currentProvider, data, setupData );

			// provider is not working... try to find fallbacks
			}, function( err ) {
				// don't use fallbacks
				if ( noFallback ) {
					return Promise.reject( err );
				}

				// get fallback of current provider
				let fallbackProvider = getFallback( currentProvider );

				// no further fallbacks defined?
				return !fallbackProvider
					? Promise.reject( err )
					: testProvider( fallbackProvider );
			});
	}

	return testProvider( provider );
}
