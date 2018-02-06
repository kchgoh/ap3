/* Framework */
import {ViewChild, Component, isDevMode} from '@angular/core';
import {Platform, MenuController, Nav, ToastController, ModalController, Events, Config} from 'ionic-angular';
import {DomSanitizer} from '@angular/platform-browser';
import {TranslateService} from '@ngx-translate/core';
import {Http} from '@angular/http';

/* Providers (make sure to add to app.module.ts providers too) */
import {AppCamera} from '../providers/camera/app-camera';
import {GlobalVars} from '../providers/globalvars/globalvars';
import {AppAds} from '../providers/appads/appads';
import {FBConnectAppSettings} from '../providers/facebook/fbconnect-settings';
import {FbConnectIframe} from '../providers/facebook/login-iframe';
import {PushService} from '../providers/push/push';
import {AppWoo} from '../providers/appwoo/appwoo';
import {AppData} from '../providers/appdata/appdata';
import {AppGeo} from '../providers/appgeo/appgeo';
import {Logins} from "../providers/logins/logins";

/* Native */
import { StatusBar } from '@ionic-native/status-bar';
import { SocialSharing } from '@ionic-native/social-sharing';
import { Device } from '@ionic-native/device';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { SplashScreen } from '@ionic-native/splash-screen';
import { Push, PushObject, PushOptions } from '@ionic-native/push';
import { Dialogs } from '@ionic-native/dialogs';
import { Network } from '@ionic-native/network';
import { Keyboard } from '@ionic-native/keyboard';
import {Storage} from '@ionic/storage';

@Component({
  templateUrl: 'app.html'
})

export class MyApp {
  @ViewChild(Nav) nav: Nav;

  pages: any;
  styles: any;
  apiurl: string;
  login: boolean;
  navparams: any = [];
  tabs: any;
  originalTabs: any;
  login_data: any;
  showmenu: boolean = false;
  apptitle: string;
  introshown: any;
  networkState: any;
  bothMenus: boolean = false;
  myLoginModal: any;
  showLogin: boolean = false;
  menu_side: string = "left";
  rtl: boolean = false;
  ajax_url: string;
  searchPageId : string;
  searchPageMenuIdx : number;

  constructor(
    private platform: Platform,
    public appCamera: AppCamera,
    private menu: MenuController,
    private globalvars: GlobalVars,
    private appads: AppAds,
    private appgeo: AppGeo,
    private fbconnectvars: FBConnectAppSettings,
    private fbconnectIframe: FbConnectIframe,
    private sanitizer: DomSanitizer,
    private pushService: PushService,
    private appwoo: AppWoo,
    private appdata: AppData,
    private logins: Logins,
    public toastCtrl: ToastController,
    public storage: Storage,
    public modalCtrl: ModalController,
    public events: Events,
    public translate: TranslateService,
    private Keyboard: Keyboard,
    private SplashScreen: SplashScreen,
    private StatusBar: StatusBar,
    private Network: Network,
    private SocialSharing: SocialSharing,
    private Device: Device,
    private Push: Push,
    private http: Http,
    private Dialogs: Dialogs,
    private config: Config
  ) {

    this.initializeApp();

    events.subscribe('user:login', data => {
      this.userLogin(data);
    });

    events.subscribe('user:logout', data => {
      this.userLogout(data);
    });

    events.subscribe('data:update', obj => {
      this.fetchData( obj );
    });

    events.subscribe('login:force_login', () => {
      this.openLoginModal();
    });

    events.subscribe('api:force_logout', () => {
      this.forceLogout();
    });

    events.subscribe('pushpage', page => {
      this.pushPage( page );
    });

    events.subscribe('opensearch', () => {
      this.openSearch();
    });

  }

  initializeApp() {

    this.platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.

      this.apiurl = this.globalvars.getApi();
      
      this.fetchData( false );

      this.doConnectionEvents();

      this.attachListeners();
      
      this.maybeDoPush();

      // prevents bug where select done button didn't display
      this.Keyboard.hideKeyboardAccessoryBar(false);
      // Disable scroll fixes webview displacement, but hides content lower on page. Can't use
      //Keyboard.disableScroll(true);

      // check for API updates on resume and on initial load
      this.platform.resume.subscribe(() => {
          console.log('App resumed');
          this.appdata.checkForUpdates( this.apiurl );
      });

      setTimeout( () => {
        this.appdata.checkForUpdates( this.apiurl );
      }, 5000 );

    });

  }

  fetchData( reset ) {

    // if refreshing the app, have to reset variables first
    if( reset ) {
      this.tabs = [];
      this.pages = null;
      this.bothMenus = false;
      this.navparams = [];
      this.showmenu = false;
    }

    // get our app data, then use it. will return either local data, or get from api
    this.appdata.load(this.apiurl).then( (data: any) => {

      console.log('Got data', data);

      this.afterData(data);

    }).catch( e => {

      // if there's a problem, default to app-data.json
      console.log( 'problem getting appdata, getting local json file', e );

      this.appdata.getData( 'app-data.json' ).then( (data:any) => {
        console.log('Got local data file.');

        this.afterData(data);

      });

    });
  }

  afterData(data) {

    this.SplashScreen.hide();
    this.configureSearchPage(data);
    this.loadMenu(data);

    this.showLogin = ( data.side_menu_login == "on" ) ? true : false;
    this.logins.set_force_login( (data.side_menu_force_login == "on") );

    this.menu_side = ( data.meta.menu_right == true ) ? "right" : "left";

    this.rtl = ( data.meta.rtl == true ) ? true : false;

    this.verifyLanguageFile(data);

    if( this.rtl === true )
      this.platform.setDir('rtl', true)

    this.loadStyles(data);
    
    this.doStatusBar(data);
    this.getSetLang(data);
    this.getSetLogin();

    this.apptitle = data.title;

    this.storage.get( 'purchased_ad_removal' ).then( res => {

      if( !res ) {
        this.maybeDoAds(data);
      }

    })

    if( data.show_registration_link === 'on' && data.registration_url ) {
      this.storage.set( 'registration_url', data.registration_url );
    }

  }

  // to use this, AppData menu items should have one with matching slug.
  // this then overrides the page type for special handling
  configureSearchPage(data) {
    let idx = 0;
    for( let item of data.menus.items ) {
      if( item.slug === 'search' ) {
        //item.title = '\u641c\u7d22';
        item.page_type = 'search';
        this.searchPageId = item.page_id;
        this.searchPageMenuIdx = idx;
      }
      idx++;
    }
  }

  openSearch() {
    let searchPage = this.pages[this.searchPageMenuIdx];
    this.pushPage(searchPage);
  }

  loadMenu(data) {

    // console.log('loadmenu', data);
    // any menu imported from WP has to use same component. Other pages can be added manually with different components

    // If we have a tab menu, set that up
    if( data.tab_menu.items ) {

      // Add pages manually here, can use different components like this... (then use the slug name to create your page, etc. www/build/custom.html)
      // let e = { 'title': "Custom Page", 'type': 'apppages', 'class': "information-circle", slug: 'custom', extra_classes: '' };

      // data.tab_menu.items.push( e );

      for( let item of data.tab_menu.items ) {

        // set component, default is Iframe
        var root = 'Iframe';

        if( item.type === 'apppages' && item.page_type === 'list' ) {
          root = 'PostList';
        } else if( item.type === 'apppages' ) {
          root = this.getPageModuleName(item.page_id);
        }

        // hide the tab if user added class of hide
        item.show = true;
        if( item.extra_classes.indexOf('hide') >= 0 || item.extra_classes.indexOf('loggedin') >= 0 ) {
          item.show = false;
        }

        this.navParamsPush(item, root);

      }

      this.tabs = this.navparams;
      if(typeof this.originalTabs === 'undefined')
        this.originalTabs = this.tabs.slice(); // make a copy

      this.nav.setRoot('TabsPage', this.tabs);

    }

    if( data.menus.items ) {

      this.pages = data.menus.items;

      this.showmenu = true;

      // Add pages manually here, can use different components like this... (then use the slug name to create your page, etc. www/build/custom.html)
      // let e = { 'title': "Custom Page", 'component': CustomPage, 'class': "information-circle", 'navparams': { slug: 'custom' }, extra_classes: '' };

      // this.pages.push( e );

      // set the home page to the proper component
      if( this.tabs ) {

        this.pages.unshift( { 'title': data.tab_menu.name, 'url': '', 'component': 'TabsPage', 'navparams': this.navparams, 'class': 'home', 'extra_classes':'hide', 'is_home': true } );
      } else if( !this.tabs && data.menus.items[0].type === 'apppages' ) {

        // used for custom logo
        data.menus.items[0].is_home = true;

        // if it's a list page, use PostList component
        if( data.menus.items[0].page_type === 'list' ) {
          this.nav.setRoot( 'PostList', data.menus.items[0] );
        } else {
          // otherwise use CustomPage
          this.nav.setRoot( this.getPageModuleName(data.menus.items[0].page_id), data.menus.items[0] );
        }

      } else {

        // used for custom logo
        data.menus.items[0].is_home = true;

        // anything else uses Iframe component
        this.nav.setRoot( 'Iframe', data.menus.items[0] );

      }

    }

    // Only show the intro if there's a slug
    if( data.meta.intro_slug && data.meta.intro_slug != '' )
      this.maybeShowIntro( data.meta.intro_slug );

    if( data.tab_menu.items && data.menus.items ) {
      // we have both menus, use pushPage on sidemenu
      this.bothMenus = true;
    }

  }

  // construct tab items
  navParamsPush( item, root ) {

    let page: object;

    this.navparams.push( { 
      'title': item.title,
      'url': item.url, 
      'root': root,
      'icon': item.class,
      'slug': item.slug,
      'list_route': item.list_route,
      'list_display': item.list_display,
      'favorites': item.favorites,
      'extra_classes': item.extra_classes,
      'show' : item.show,
      'show_slider': item.show_slider,
      'slide_route': item.slide_route,
      'type': item.type,
      'page_type': item.page_type,
      'page_id': item.page_id,
      'is_home': true
    } );

  }

  // If there is a page called "Intro", show it the first time the app is used
  maybeShowIntro(slug) {

    this.introshown = window.localStorage.getItem('app-intro-shown');

    if( this.introshown === "true" ) 
      return;

    let page_id = this.getPageIdBySlug(slug);

    let intro = { 'title': "Introduction", 'component': this.getPageModuleName(page_id), 'class': "", 'navparams': { 'slug': slug } };

    this.nav.push( this.getPageModuleName(page_id), intro.navparams );

    window.localStorage.setItem('app-intro-shown', "true" );
  }

  /**
   * Get side menu index by page slug
   */
  getMenuIndexBySlug(slug: string) {
    return this.getIndexBySlug(slug, this.pages);
  }

  /**
   * Get tab menu index by page slug
   * @param slug page slug
   */
  getTabIndexBySlug(slug: string) {
    return this.getIndexBySlug(slug, this.tabs);
  }

  /**
   * Side or tab menus
   * @param slug page slug
   * @param pages menu or tab pages
   */
  getIndexBySlug(slug: string, pages) {
    let menu_index: number;
    let count: number = 0;

    if(!pages)
			return menu_index;

    for(let page of pages) {
      if(page.slug && page.slug == slug) {
        menu_index = count;
      }
      count++;
    };

    if(!menu_index && menu_index !== 0)
      console.log(pages); // you can find the slugs here

    return menu_index;
  }

  getPageIdBySlug(slug) {

    let page_id = 0;

    this.pages.forEach(page => {
      if(page.slug && page.slug == slug && page.page_id)
        page_id = page.page_id;
    });

    return page_id;
  }

  getPageBySlug(slug) {

    let mypage: any;

    this.pages.forEach(page => {
      if(page.slug && page.slug == slug && page.page_id)
        mypage = page;
    });

    return mypage;
  }

  // side menu link. determine which func to use
  menuLink(p, e) {

    if( p.extra_classes.indexOf('submenu-parent') >= 0 ) {
      this.doSubMenus(e)
      return;
    }

    if( this.bothMenus || ( p.extra_classes && p.extra_classes.indexOf('push-page') >= 0 ) ) {
      this.pushPage(p);
    } else {
      this.openPage(p);
    }
  }

  // Handles opening and closing submenus
  doSubMenus(e) {

    var button;
    if( e.target.classList && e.target.classList.contains('submenu-parent') ) {
      button = e.target;
    } else if( e.target.classList ) {
      button = e.target.closest('.submenu-parent');
    }

    if( button.classList && button.classList.contains('submenu-parent') ) {

      if( button.classList.contains('open-menu') ) {
        button.classList.remove('open-menu');
      } else {
        button.classList.add('open-menu');
      }

      var el = button.nextSibling;

      while( el.classList && el.classList.contains( 'submenu-child' ) ) {
        if( el.classList.contains( 'open' ) ) {
          el.classList.remove( 'open' );
        } else {
          el.classList.add( 'open' );
        }
        el = el.nextSibling;
      }
      return;

    }

  }

  openPage(page) {

    // don't do anything if someone clicks a nav divider
    if( typeof( page.extra_classes ) != "undefined" && page.extra_classes.indexOf('divider') >= 0 )
      return

    // close the menu when clicking a link from the menu
    this.menu.close();

    if( page.target === '_blank' && typeof(page.extra_classes) !== 'undefined' && page.extra_classes.indexOf('system') >= 0 ) {
      this.openIab( page.url, '_system', null );
      return;
    } else if( page.target === '_blank' ) {
      this.openIab( page.url, page.target, null );
      return;
    }

    if( page.type === 'apppages' && page.page_type === 'list' ) {
      this.nav.setRoot( 'PostList', page );
    } else if( page.type === 'apppages' ) {
      this.nav.setRoot(this.getPageModuleName(page.page_id), page );
    } else if (page.url) {
      this.nav.setRoot('Iframe', page);
    } else {
      this.nav.setRoot(page.component, page.navparams);
    }

  }

  pushPage(page) {

    // don't do anything if someone clicks a nav divider
    if( typeof( page.extra_classes ) != "undefined" && page.extra_classes.indexOf('divider') >= 0 )
      return

    // close the menu when clicking a link from the menu
    this.menu.close();

    if( page.target === '_blank' && page.extra_classes.indexOf('system') >= 0 ) {
      this.openIab( page.url, '_system', null );
      return;
    } else if( page.target === '_blank' ) {
      this.openIab( page.url, page.target, null );
      return;
    }

    let opt = {};

    if( this.rtl === true && this.platform.is('ios') )
      opt = { direction: 'back' }

    if( page.type === 'apppages' && page.page_type === 'list' ) {
      this.nav.push( 'PostList', page, opt );
    } else if( page.type === 'apppages' ) {
      this.nav.push(this.getPageModuleName(page.page_id), page, opt );
    } else if (page.url) {
      this.nav.push('Iframe', page, opt);
    } else {
      this.nav.push(page.component, page.navparams, opt);
    }
  }

  openTab(tab_index: number) {
    this.restoreTabs();
    let tabs = this.nav.getActiveChildNav();
    if(tabs) {
      this.nav.popToRoot({animate:true}).then(() => { // close any transitioned pages
          tabs.select(tab_index);
      });
    }
  }

  /**
   * Experimental: need to get this.removeNewTab() working
   * @param page object
   */
  openNewTab(page) {
    this.nav.popToRoot({animate:true}).then(() => { // close any transitioned pages
      this.restoreTabs();
      this.tabs.unshift(page);
      let loggedin = (typeof this.login_data === 'object');
      this.resetTabs(loggedin);
      this.nav.setRoot( 'TabsPage', this.navparams );
    });
  }

  /**
   * Restore the original tabs.
   */
  restoreTabs() {
    this.tabs = this.originalTabs.slice(); // copy back
  }

  openMenuLink(data: {menulink}) {
    let page: any;
    let menu_index: number;

    if(typeof data.menulink.menu !== 'undefined') { // might be 0; check undefined
      if(typeof data.menulink.menu === 'number')
        menu_index = data.menulink.menu;
      else if(typeof data.menulink.menu === 'string')
        menu_index = this.getMenuIndexBySlug(data.menulink.menu);
      if(typeof menu_index !== 'undefined')
        page = this.pages[menu_index];
    } else if(typeof data.menulink.tab_menu !== 'undefined') {
      if(typeof data.menulink.tab_menu === 'number')
        menu_index = data.menulink.tab_menu;
      else if(typeof data.menulink.tab_menu === 'string')
        menu_index = this.getTabIndexBySlug(data.menulink.tab_menu);
      if(typeof menu_index !== 'undefined')
        page = this.tabs[menu_index];
    }

    // Verify logins
    if(page && page.extra_classes) {
      if(page.extra_classes == 'loggedin' && typeof this.login_data != 'object') {
        this.translate.get('Please login').subscribe( text => {
          this.presentToast(text);
        });
        return;
      }
      if(page.extra_classes == 'loggedout' && typeof this.login_data == 'object') {
        console.log('login_data', this.login_data);
        page = null;
      }
    }

    if(page) {

      if(data.menulink.new_tab) {
        this.openNewTab(page);
      } else if(data.menulink.backbtn || typeof data.menulink.menu !== 'undefined') {
        this.pushPage(page);
      } else {
        this.openTab(menu_index);
      }
    } else {
      this.translate.get('Page not found').subscribe( text => {
        this.presentToast(text);
      });
    }
  }

  getPageModuleName(page_id) {
    if(!isDevMode())
      return 'Page'+page_id;
    else if(page_id === this.searchPageId)
      return 'SearchPage';
    else
      return 'CustomPage';
  }

  doStatusBar(data) {

    if( !this.StatusBar )
      return;

    if( data.meta.light_status_bar == true ) {
      // Light text, for dark backgrounds
      this.StatusBar.styleLightContent();
    } else {
      // Dark text
      this.StatusBar.styleDefault();
    }

    // Android only, background color
    if( this.platform.is('android') ) {
      if( data.meta.design && data.meta.design.status_bar_bkg ) {
        this.StatusBar.backgroundColorByHexString(data.meta.design.status_bar_bkg);
      }
    }

  }

  doConnectionEvents() {

    this.networkState = this.Network.type;

    if( this.networkState === 'none' || this.networkState === 'unknown' ) {
      this.translate.get('You appear to be offline, app functionality may be limited.').subscribe( text => {
        this.presentToast(text);
      });
    }

  }

  loadStyles( data ) {

    // console.log( data );

    // kinda hacky, but it works
    let styles = "<style>";

    // toolbar color
    styles += ".toolbar-background-md, .toolbar-background-ios, .tabs-md .tabbar, .tabs-ios .tabbar, .custom-page .menu-card { background: " + data.meta.design.toolbar_background + " }";

    // toolbar text
    styles += ".toolbar-content, .toolbar-title, .bar-button-default, .toolbar .bar-button-default:hover, .toolbar .segment-button, .toolbar button.activated, .tabs .tab-button .tab-button-icon, .tab-button .tab-button-text, .tabbar .tab-button[aria-selected=true] .tab-button-icon, ion-toolbar .button { color: "  + data.meta.design.toolbar_color + " }";

    // left menu colors
    styles += ".menu-inner .content-md, .menu-inner .content-ios, .menu-inner ion-list .item { color: "  + data.meta.design.left_menu_text + "; background-color: "  + data.meta.design.left_menu_bg + " }";
    styles += ".menu-inner .loggedin-msg { color: "  + data.meta.design.left_menu_text + " }";

    // left menu icon color
    if( data.meta.design.left_menu_icons ) {
      styles += "ion-menu .list-md ion-icon, ion-menu .list-ios ion-icon, .menu-inner .submenu-parent::after { color: "  + data.meta.design.left_menu_icons + " }";
      styles += ".menu-inner .item-ios[detail-push] .item-inner, .menu-inner button.item-ios:not([detail-none]) .item-inner, .menu-inner a.item-ios:not([detail-none]) .item-inner { background-image: url(\"data:image/svg+xml;charset=utf-8,<svg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2012%2020'><path%20d='M2,20l-2-2l8-8L0,2l2-2l10,10L2,20z'%20fill='" + data.meta.design.left_menu_icons + "'/></svg>\"); }";
    }

    // body text and background
    styles += ".ion-page ion-content, .ion-page ion-list .item { color: "  + data.meta.design.text_color + "; background-color: "  + data.meta.design.body_bg + " }";
    styles += "p, .item p { color: "  + data.meta.design.text_color + " }";

    // buttons
    styles += ".button-primary, .menu-login-button { background: " + data.meta.design.button_background + "!important; color: "  + data.meta.design.button_text_color + " }";

    // headings
    styles += "ion-page h1, ion-page h2, ion-page h3, ion-page h4, ion-page h5, ion-page h6, ion-page ion-list .item h2, ion-page ion-list .item h3, ion-page ion-list .item h4 { color: "  + data.meta.design.headings_color + " }";

    // links
    styles += "ion-page ion-content a, ion-page ion-content a:visited { color: "  + data.meta.design.link_color + " }";

    styles += data.meta.design.custom_css;

    // hide menu toggle if no left menu
    if( this.showmenu === false ) {
      styles += 'ion-navbar .bar-button-menutoggle { display: none !important; }';
    }

    // maybe move menu item to right
    if( this.menu_side === "right" && this.rtl === false || this.menu_side === "left" && this.rtl === true ) {
      styles += 'ion-navbar .bar-buttons[start] { order: 7; }';
    }

    styles += "</style>";

    this.styles = this.sanitizer.bypassSecurityTrustHtml( styles );
    
  }

  /* 
  * We are listening for postMessage events from the iframe pages. When something needs to happen, a message is sent from the iframe as a JSON object, such as { iablink: 'http://apppresser.com', target: '_blank', options: '' }. We parse that object here, and do the phonegap stuff like window.open(data.iablink)
  */

  attachListeners() {

    // When WP site loads, attach our click events
    window.addEventListener('message', (e) => {

      // might be undefined, but we only using strings here
      if( typeof e.data !== 'string' || e.data == '' )
        return;

      console.log('postMessage', e.data);

      if( e.data === 'checkin_success' ) {

        this.translate.get('Check in successful!').subscribe( text => {
          this.presentToast(text);
        });

      } else if ( e.data === 'logout' ) {

        this.userLogout()

      }

      // if it's not our json object, return
      if (e.data.indexOf('{') != 0)
        return;

      var data = JSON.parse(e.data);

      if (data.url) {

        // push a new page
        let page = { title: data.title, component: 'Iframe', url: data.url, classes: null };
        this.pushPage( page );

      } else if (data.msg) {

        // social sharing was clicked, show that
        this.SocialSharing.share(data.msg, null, null, data.link);

      } else if (data.iablink) {

        // in app browser links
        this.openIab(data.iablink, data.target, data.options);

      } else if (data.camera && data.camera === 'library' ) {

        if(data.appbuddy === true ) {
          this.appCamera.photoLibrary(true);
        } else {
          this.appCamera.photoLibrary(false);
        }

      } else if (data.camera && data.camera === 'photo') {
        
        if (data.appbuddy === true) {
          this.appCamera.openSheet(true);
        } else {
          this.appCamera.takePicture(false);
        }

      } else if ( data.fblogin ) {

        this.fbconnectIframe.login();

        this.maybeSendPushId( data.ajaxurl );

      } else if ( data.paypal_url ) {

        this.appwoo.paypal( data.paypal_url, data.redirect );

      } else if( data.loggedin ) {

        let avatar = this.logins.get_avatar(data); // logic for FB or WP
        if(avatar)
          data.avatar = avatar;

        this.userLogin(data)

        this.storage.set('user_login', this.login_data )

      } else if( typeof( data.isloggedin ) != "undefined" ) {

        // make sure app and WP have the same status
        this.syncLoginStatus( data )

      } else if( data.apppage ) {
        let page = { title: data.title, component: 'Iframe', url: data.apppage.url, classes: null, page_type: null, type: null };
        this.openPage( page );
      } else if( data.geouserpref ) {
        this.appgeo.startBeacon(data.geouserpref);
      } else if(data.menulink) {
        this.openMenuLink(data);
      }

    }, false); // end eventListener

  }

  openIab( link, target, options = null ) {

    window.open(link, target, options );

  }

  maybeDoAds(data) {

    console.log('ads')

    // only show ads on a device
    if( !this.Device.platform ) 
      return;

    // If we don't have any ads set, stop
    if( data.ads.ios === '' && data.ads.android === '' ) {
      console.log('No ads');
      return;
    }

    this.appads.setOptions();

    if( this.Device.platform === 'iOS' && data.ads.ios.banner != '' ) {
      this.appads.createBanner( data.ads.ios.banner );
    }
     
    if( this.Device.platform === 'Android' && data.ads.android.banner != '' ) {
      this.appads.createBanner( data.ads.android.banner );
    }

    // show interstitial like this
    // this.appads.interstitial( data.ads.ios.interstitial );

  }

  maybeDoPush() {

    let push = null;

    try {

      push = this.Push.init({
        android: {
            icon: "phonegap",
            senderID: "[[gcm_sender]]"
        },
        ios: {
            alert: "true",
            badge: true,
            clearBadge: true,
            sound: 'true'
        },
        windows: {}
      });

    } catch(err) {
      console.log(err);
      return;
    }

    if( push.error )
      return;

    push.on('registration').subscribe((data: any) => {

      this.storage.set('deviceToken', data.registrationId)

      // kick off aws stuff
      this.pushService.subscribeDevice(data.registrationId).then( (result:string) => {
        var newresult = JSON.parse( result );

        this.storage.set('endpointArn', newresult.endpointArn )

      });

    });

    push.on('notification').subscribe((data: any) => {

      // if apppush post URL
      if( data.additionalData && data.additionalData.url && data.additionalData.url.indexOf('http') == 0 && data.additionalData.target && data.additionalData.target == '_self' ) {
        let page = { title: data.title, component: 'Iframe', url: data.additionalData.url, classes: null };
        this.pushPage( page );
        return;
      }

      // if there's an external url from apppush custom url field, open in IAB
      if( data.additionalData && data.additionalData.url && data.additionalData.url.indexOf('http') == 0 ) {
        this.openIab( data.additionalData.url, '_blank' );
        return;
      }

      // if there's an app page, open it
      if( data.additionalData && (<any>data).additionalData.page ) {

        let page = (<any>data).additionalData.page;

        // if page is external, fire the in app browser
        if( page.target === '_blank' ) {
          this.openIab( page.url, page.target );
          return;
        }

        // if they included an app page, load the page
        this.pushPage( (<any>data).additionalData.page );
      }

      this.Dialogs.alert(
        data.message,  // message
        data.title,            // title
        this.translate.instant('Done')  // buttonName
      );

    });

    push.on('error').subscribe((e) => {
      console.log(e.message);
    });

  }

  maybeSendPushId( ajaxurl? ) {

    if(!ajaxurl)
      ajaxurl = this.getAjaxURL();

    if(!ajaxurl) {
      console.log('Not able to send endpointArn, missing ajaxurl');
      return;
    }

    this.storage.get('endpointArn').then( id => {

      if( id ) {
        // ajax call to save this to user meta
        this.pushService.sendDeviceToWp(id, ajaxurl).then( result => {
          console.log(result);
        });
      }

    })

  }

  presentToast(msg) {

    let toast = this.toastCtrl.create({
      message: msg,
      duration: 5000,
      position: 'bottom'
    });

    toast.present();

  }

  menuOpened() {
    this.menu.swipeEnable(true)
  }

  menuClosed() {
    this.menu.swipeEnable(false)
  }

  openLoginModal() {

    this.myLoginModal = this.modalCtrl.create( 'LoginModal' );
    
    this.myLoginModal.present();

  }

  userLogin(data) {

    let avatar = this.logins.get_avatar(data);

    if(avatar)
      data.avatar = avatar;

    this.login_data = data;

    this.maybeSendPushId();
    // tell the modal we are logged in
    this.events.publish('modal:logindata', data )

    this.translate.get('Login successful').subscribe( text => {
      this.presentToast(text);
    });
    
    this.maybeLogInOutRedirect(data);

    if( this.pages )
      this.resetSideMenu(true)

    if( this.tabs )
      this.resetTabs(true)
  }

  /**
   * Handle the appp_login_redirect filter from WordPress
   * @param data Login data
   */
  maybeLogInOutRedirect(data) {

    let redirect: any;

    if(data.login_redirect)
      redirect = data.login_redirect;
    else if(data.logout_redirect)
      redirect = data.logout_redirect;
    else {
      // KG: for API login, just reset to main page
      let mainPage = this.pages[this.mainPageMenuIdx];
      this.nav.setRoot( 'MainPage', mainPage );
      // don't do the rest
      return;
    }
    
    if(redirect) {
      console.log('redirecting to ', redirect);

      let page: object|boolean;
      let title = '';
      let url = '';

      if(typeof redirect === 'string') {
        url = redirect;
      } else if(typeof redirect === 'object') {
        title = redirect.title;
        url = redirect.url;
      }

      if(!url) {
        return;
      } else if(url.indexOf('http') === -1) {

        // load by page slug

        let page_slug = url;
        page = this.getPageBySlug(page_slug);
        if(page) {
          this.pushPage(page);
        } else {
          this.translate.get('Page not found').subscribe( text => {
            this.presentToast(text);
          });
        }
      } else {

        // load by URL

        page = { 
          title: title,
          url: url,
          component: 'Iframe',
          classes: null,
          target: '',
          extra_classes: '',
        };
        
        this.pushPage(page);
      }   
    }
  }
  userLogout(logout_response?) {
    // this.storage.remove('user_login').then( () => {
    //   this.presentToast('Logged out successfully.')
    // })

    this.login_data = null;

    if( this.tabs && this.pages ) {
      this.resetTabs(false)
      this.resetSideMenu(false)
    } else if( this.tabs ) {
      this.resetTabs(false)
    } else {
      this.resetSideMenu(false)
      // this.openPage(this.pages[0])
    }

    this.translate.get('Logout successful').subscribe( text => {
      this.presentToast(text);
    });

    this.storage.get('force_login').then((data)=>{
      if(data) {
        this.openLoginModal();
      } else if(logout_response.data && logout_response.data.logout_redirect) {
        this.maybeLogInOutRedirect(logout_response.data);
      }
    });

  }

  forceLogout() {

    this.login_data = null;

    if( this.tabs && this.pages ) {
      this.resetTabs(false)
      this.resetSideMenu(false)
    } else if( this.tabs ) {
      this.resetTabs(false)
    } else {
      this.resetSideMenu(false)
      // this.openPage(this.pages[0])
    }

    this.storage.remove('user_login');
  }

  // show or hide menu items on login or logout. resetSideMenu(false) for logout
  resetSideMenu( login ) {
    for( let item of this.pages ) {

      if( login === true && item.extra_classes.indexOf('loggedin') >= 0 ) {
        item.extra_classes += " show";
      } else if( login === false && item.extra_classes.indexOf('loggedin') >= 0 ) {
        item.extra_classes = item.extra_classes.replace(" show", "");
      } else if( login === true && item.extra_classes.indexOf('loggedout') >= 0 ) {
        item.extra_classes += " hide";
      } else if( login === false && item.extra_classes.indexOf('loggedout') >= 0 ) {
        item.extra_classes = item.extra_classes.replace(" hide", "");
      }

    }
  }

  // show or hide tabs on login or logout. resetTabs(false) for logout
  resetTabs( login ) {

    this.navparams = []

    for( let item of this.tabs ) {

      // set component, default is Iframe
      var root = 'Iframe';

      if( item.type === 'apppages' && item.page_type === 'list' ) {
        root = 'PostList';
      } else if( item.type === 'apppages' ) {
        root = this.getPageModuleName(item.page_id);
      }

      // hide the tab if user added class of hide
      item.show = true;
      if( item.extra_classes.indexOf('hide') >= 0 ) {
        item.show = false;
      }

      if( login === false && item.extra_classes.indexOf('loggedin') >= 0 ) {
        item.show = false;
      } else if( login === true && item.extra_classes.indexOf('loggedout') >= 0 ) {
        item.show = false;
      }

      item.class = item.icon

      this.navParamsPush( item, root )

    }

    this.tabs = this.navparams;

    // "refresh" the view by resetting to home tab
    if( login === false ) {
        //this.openPage( { 'title': this.tabs[0].title, 'url': '', 'component': 'TabsPage', 'navparams': this.navparams, 'class': this.tabs[0].icon } )
        this.nav.setRoot( 'TabsPage', this.navparams );
      }

  }

  getSetLogin() {

    this.storage.get('user_login').then( data => {
        if(data) {

          let avatar = this.fbconnectvars.get_avatar();
          if(avatar)
            data.avatar = avatar;

          this.login_data = data;
          
          if( this.pages )
            this.resetSideMenu(true)

          if( this.tabs )
            this.resetTabs(true)
    
        }
    })

  }

  getSetLang( data ) {

    if(data.languages) {
      this.storage.set('available_languages', data.languages)
    } else {
      this.storage.remove('available_languages')
    }

    this.storage.get( 'app_language' ).then( lang => {
      if( lang ) {
        this.translate.use( lang )

        this.setBackBtnText();
        
      }
    })

  }

  syncLoginStatus( data ) {

    // sync login status. If WP and app doesn't match up, fix it

    if( data.isloggedin == false && this.login_data ) {

      // logged out of WP but still logged into app: log out of app
      this.login_data = null
      this.storage.remove('user_login');
      this.events.publish( 'modal:logindata', null )
      this.events.publish( 'user:logout', null );

    } else if( data.isloggedin == true && !this.login_data ) {

      // logged into WP but logged out of app: log into app
      if( data.avatar_url && data.message ) {
        this.login_data = { loggedin: true, avatar: this.logins.get_avatar(data.avatar_url), message: data.message }
      } else {
        this.login_data = { loggedin: true }
      }
      

      this.storage.set('user_login', this.login_data ).then( () => {

        this.events.publish( 'modal:logindata', this.login_data )

      })
      
    }

  }

  getAjaxURL() {

    if(!this.ajax_url) {
      let item = window.localStorage.getItem( 'myappp' );
      let myapp = JSON.parse( item );
      if(myapp.wordpress_url) {
        this.ajax_url = myapp.wordpress_url + 'wp-admin/admin-ajax.php';
      } else {
        return '';
      }
    }

    return this.ajax_url;
    
  }

  verifyLanguageFile(data) {
    // check if language file exists. If not, default to en.json
    this.langFileExists(data).then( data => {
      const lang = (<string>data)

      console.log('set language to ' + lang);

      this.translate.setDefaultLang(lang);
      this.setBackBtnText();
    });
  }

  langFileExists(data) {
		return new Promise( (resolve, reject) => {

			if(data.default_language) {

				const lang = data.default_language;

				this.http.get( './assets/i18n/'+lang+'.json' )
					.subscribe(data => {

						// language file exists, return url 
						resolve(lang);
				},
				error => {
					// language file does not exist
					resolve('en');
				});

			} else {
				resolve('en');
			}
	    });
	}

  setBackBtnText() {

    this.translate.get('Back').subscribe( text => {
      console.log('Back ' + text )
      this.config.set('ios', 'backButtonText', text );
    });

  }

}