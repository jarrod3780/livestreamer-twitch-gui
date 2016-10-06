import {
	get,
	set,
	computed,
	inject,
	observer,
	Controller
} from "Ember";
import {
	main,
	files,
	langs,
	themes
} from "config";
import RetryTransitionMixin from "mixins/RetryTransitionMixin";
import { playerSubstitutions } from "models/LivestreamerParameters";
import qualities from "models/LivestreamerQualities";
import Settings from "models/localstorage/Settings";
import {
	isWin,
	isWinGte8,
	isDarwin
} from "utils/node/platform";
import resolvePath from "utils/node/resolvePath";
import {
	isSupported as isNotificationSupported,
	show as showNotification
} from "utils/Notification";


const { alias, equal } = computed;
const { service } = inject;
const { "display-name": displayName } = main;
const { icons: { big: bigIcon } } = files;
const { themes: themesList } = themes;


function settingsAttrMeta( attr, prop ) {
	return computed(function() {
		return Settings.metaForProperty( attr ).options[ prop ];
	});
}


export default Controller.extend( RetryTransitionMixin, {
	chat: service(),
	modal: service(),
	settings: service(),

	isAnimated: false,

	qualities,
	Settings,
	platform: {
		isWinGte8,
		isDarwin
	},


	hlsLiveEdgeDefault: settingsAttrMeta( "hls_live_edge", "defaultValue" ),
	hlsLiveEdgeMin    : settingsAttrMeta( "hls_live_edge", "min" ),
	hlsLiveEdgeMax    : settingsAttrMeta( "hls_live_edge", "max" ),

	hlsSegmentThreadsDefault: settingsAttrMeta( "hls_segment_threads", "defaultValue" ),
	hlsSegmentThreadsMin    : settingsAttrMeta( "hls_segment_threads", "min" ),
	hlsSegmentThreadsMax    : settingsAttrMeta( "hls_segment_threads", "max" ),

	retryStreamsDefault: settingsAttrMeta( "retry_streams", "defaultValue" ),
	retryStreamsMin    : settingsAttrMeta( "retry_streams", "min" ),
	retryStreamsMax    : settingsAttrMeta( "retry_streams", "max" ),

	retryOpenDefault: settingsAttrMeta( "retry_open", "defaultValue" ),
	retryOpenMin    : settingsAttrMeta( "retry_open", "min" ),
	retryOpenMax    : settingsAttrMeta( "retry_open", "max" ),


	substitutionsPlayer: playerSubstitutions,
	substitutionsChatCustom: alias( "chat.substitutionsCustom" ),


	chatMethods: computed(function() {
		return Settings.chat_methods.filter(function( method ) {
			return !method.disabled;
		});
	}),

	isChatMethodDefault: equal( "model.chat_method", "default" ),
	isChatMethodMSIE   : equal( "model.chat_method", "msie" ),
	isChatMethodCustom : equal( "model.chat_method", "custom" ),
	isChatMethodChatty : equal( "model.chat_method", "chatty" ),


	themes: computed(function() {
		return themesList.map(function( theme ) {
			return {
				id   : theme,
				label: theme.substr( 0, 1 ).toUpperCase() + theme.substr( 1 )
			};
		});
	}),


	hasTaskBarIntegration: equal( "model.gui_integration", 1 ),
	hasBothIntegrations  : equal( "model.gui_integration", 3 ),

	_minimizeObserver: observer( "model.gui_integration", function() {
		var int    = get( this, "model.gui_integration" );
		var min    = get( this, "model.gui_minimize" );
		var noTask = ( int & 1 ) === 0;
		var noTray = ( int & 2 ) === 0;

		// make sure that disabled options are not selected
		if ( noTask && min === 1 ) {
			set( this, "model.gui_minimize", 2 );
		}
		if ( noTray && min === 2 ) {
			set( this, "model.gui_minimize", 1 );
		}

		// enable/disable buttons
		set( Settings, "minimize.1.disabled", noTask );
		set( Settings, "minimize.2.disabled", noTray );
	}),


	languages: computed(function() {
		return Object.keys( langs )
			.filter(function( code ) {
				return !langs[ code ].disabled;
			})
			.map(function( code ) {
				return {
					id  : code,
					lang: langs[ code ][ "lang" ].capitalize()
				};
			});
	}),


	// filter available notification providers
	notifyProvider: function() {
		return Settings.notify_provider.filter(function( item ) {
			return isNotificationSupported( item.value );
		});
	}.property(),


	actions: {
		apply( success, failure ) {
			var modal  = get( this, "modal" );
			var model  = get( this, "settings.content" );
			var buffer = get( this, "model" ).applyChanges().getContent();
			model.setProperties( buffer );
			model.save()
				.then( success, failure )
				.then( modal.closeModal.bind( modal, this ) )
				.then( this.retryTransition.bind( this ) )
				.catch( model.rollbackAttributes.bind( model ) );
		},

		discard( success ) {
			var modal = get( this, "modal" );
			get( this, "model" ).discardChanges();
			Promise.resolve()
				.then( success )
				.then( modal.closeModal.bind( modal, this ) )
				.then( this.retryTransition.bind( this ) );
		},

		cancel() {
			set( this, "previousTransition", null );
			get( this, "modal" ).closeModal( this );
		},

		checkLanguages( all ) {
			var filters = get( this, "model.gui_langfilter" );
			Object.keys( filters.content ).forEach(function( key ) {
				set( filters, key, all );
			});
		},

		testNotification( success, failure ) {
			let provider = get( this, "model.notify_provider" );
			let icon = isWin && !DEBUG
				? resolvePath( "%NWJSAPPPATH%", bigIcon )
				: resolvePath( bigIcon );
			let notification = {
				title: displayName,
				message: "This is a test notification",
				icon: `file://${icon}`
			};
			showNotification( provider, notification, provider !== "auto" )
				.then( success, failure )
				.catch(function() {});
		}
	}
});
