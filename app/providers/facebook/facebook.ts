import {Injectable} from '@angular/core';
import {Http} from '@angular/http';
import 'rxjs/add/operator/map';

// https://www.npmjs.com/package/ng2-facebook-sdk
import {FacebookService, FacebookLoginOptions, FacebookInitParams, FacebookApiMethod} from 'ng2-facebook-sdk/dist';

/*
  Facebook Connect

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class FbConnect {
  fbconnectvars: any;

  constructor(public http: Http, private FB: FacebookService) {

    this.fbconnectvars = {
      debug: false,
      login_scope: 'email,public_profile,user_friends',
      l10n:{
        login_msg:'Thanks for logging in, {{USERNAME}}!',
        fetch_user_fail:'Sorry, login failed',
        not_authorized:'Please log into this app.',
        fb_not_logged_in:'Please log into Facebook.',
        wp_login_error:'WordPress login error',
        login_fail:'Login error, please try again.'
      }
    }

    this.init(false);

  }

  init(debug) {

    this.fbconnectvars.debug = debug;

    let iframewin = document.getElementById('ap3-iframe').contentWindow.window;
      
    if( typeof iframewin.apppfb == 'undefined' ) {
      return;
    }

    iframewin.jQuery('.appfbconnectlogin').on('click', event => { 
      event.preventDefault(); 
      this.login(); 
    })

    if( typeof iframewin.apppfb.l10n !== 'undefined' ) {
      this.fbconnectvars.l10n = iframewin.apppfb.l10n
    }

    let fbParams: FacebookInitParams = {
      appId: iframewin.apppfb.app_id,
      xfbml: true,
      version: 'v2.6'
    };

    this.FB.init( fbParams );

  }

  login() {

    let loginOptions: FacebookLoginOptions = {
      scope: this.fbconnectvars.login_scope
    }
    this.FB.login( loginOptions ).then( result => {
      console.log('login result', result);
    });

    return false; // so not to submit the form
  }

  // This is called with the results from from FB.getLoginStatus().
  statusChangeCallback(response) {

    let iframedoc = document.getElementById('ap3-iframe').contentWindow.document;

    console.log('statusChangeCallback', response);

    // The response object is returned with a status field that lets the
    // app know the current login status of the person.
    // Full docs on the response object can be found in the documentation
    // for FB.getLoginStatus().
    if (response.status === 'connected') {
      // Logged into your app and Facebook.
      this.fbMe();
    } else if (response.status === 'not_authorized') {
      // The person is logged into Facebook, but not your app.
      iframedoc.getElementById('status').innerHTML = this.fbconnectvars.l10n.not_authorized;
    } else {
      // The person is not logged into Facebook, so we're not sure if
      // they are logged into this app or not.
      iframedoc.getElementById('status').innerHTML = this.fbconnectvars.l10n.fb_not_logged_in;
    }
  }

  fbMe() {

    /*
     *  method:  HTTP method: GET, POST, etc. Optional - Default is 'GET'
       *  path:    path in the Facebook graph: /me, /me.friends, etc. - Required
       *  params:  queryString parameters as a map - Optional
       *  success: callback function when operation succeeds - Optional
       *  error:   callback function when operation fails - Optional
     */

    let iframewin = document.getElementById('ap3-iframe').contentWindow.window;

    let loginOptions: FacebookApiMethod = { 'post' : 1 };

    this.FB.api( 
      "/me",
      loginOptions,
      {fields:iframewin.apppfb.me_fields}
    ).then( response => {
      this.fetchUser_Callback(response);
    });
  }

  // This function is called after a callback
  // from retreiving the user's email and fb_id
  fetchUser_Callback(response) {

    console.log('fetchUser_Callback', response);

    let iframedoc = document.getElementById('ap3-iframe').contentWindow.document;
    let iframewin = document.getElementById('ap3-iframe').contentWindow.window;
    
    if( iframedoc.getElementById('status') ) {
      iframedoc.getElementById('status').innerHTML = this.fbconnectvars.l10n.login_msg.replace('{{USERNAME}}', response.name);
    }
    // Send user info to WordPress login function
    if( typeof response.name != 'undefined' && typeof response.email != 'undefined') {
      this.wplogin( response.name, response.email ).then( data => {

        // successfully logged in
        let context = iframewin.location.pathname.substring(0, iframewin.location.pathname.lastIndexOf("/"));
        let baseURL = iframewin.location.protocol + '//' + iframewin.location.hostname + (iframewin.location.port ? ':' + iframewin.location.port : '') + context;
        let app_ver = ( iframewin.apppCore.ver ) ? iframewin.apppCore.ver : '2';

        if(data && data.redirect_url) {
          let redirect_url = data.redirect_url;
          if( redirect_url.indexOf('?') === -1 && redirect_url.indexOf('appp=') === -1 ) {
            iframewin.location.href = redirect_url+ "?appp=" + app_ver;
            return;
          } else if( redirect_url.indexOf('appp=') === -1 ) {
            iframewin.location.href = redirect_url+ "&appp=" + app_ver;
            return;
          } else {
            iframewin.location.href = data.redirect_url;
            return;
          }
        }

        iframewin.location.href = baseURL + "?appp=" + app_ver;
      });
    } else {
      console.log( response );
    }
  }

  // This function is called after a callback
  // from retreiving the user's email and fb_id
  fetchUser_CallbackError(response) {

    let iframedoc = document.getElementById('ap3-iframe').contentWindow.document;

    console.log( response );
    iframedoc.getElementById('status').innerHTML = this.fbconnectvars.l10n.fetch_user_fail;
  }

  // This function is called when someone finishes with the Login
  // Button.  See the onlogin handler attached to it in the sample
  // code below.
  checkLoginState() {
    this.FB.getLoginStatus().then( result => {
      this.statusChangeCallback(result);
    })
  }

  /* Returns promise.
   * Usage: this.wplogin(name,email).then( response => { // do something });
   */
  wplogin( name, email ) {

    let iframedoc = document.getElementById('ap3-iframe').contentWindow.document;
    let iframewin = document.getElementById('ap3-iframe').contentWindow.window;

    let options = {
      'action':'appp_wp_fblogin',
      'user_email': email,
      'security' : iframewin.apppfb.security,
      'full_name': name,
     }

    return new Promise(resolve => {

      this.http.get( iframewin.apppCore.ajaxurl, options )
        .map(res => res.json())
        .subscribe(
          data => {
          console.log(data);
          resolve(data);
          },
          error => alert(this.fbconnectvars.l10n.wp_login_error) 
        );
    });

  }

}