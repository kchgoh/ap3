import {Events} from 'ionic-angular';
import {Injectable} from '@angular/core';
import {Http} from '@angular/http';
import 'rxjs/add/operator/map';
import {Storage} from '@ionic/storage';

/*
  Adapted from Posts class, modified to request post with NONCE, which is required for REST API.
*/
@Injectable()
export class AuthPosts {
  data: any = null;

  constructor(
    public http: Http, 
    public storage: Storage,
    public eventBus: Events
    ) {}

  load(url:string, page) {

    // set pagination
    if( !page ) {
      let page = '1';
    }
      
    // if (this.data) {
    //   // already loaded data. this is handled elsewhere for now
    //   return Promise.resolve(this.data);
    // }

    return new Promise( (resolve, reject) => {

      var concat;

      // check if url already has a query param
      if( url.indexOf('?') > 0 ) {
        concat = '&';
      } else {
        concat = '?';
      }

      var applang;
      this.storage.get('app_language').then( lang => {

        applang = lang;
        return this.storage.get('user_login');

      }).then( userLogin => {

        let language = ''

        if(applang) {
          language = '&lang=' + applang
        }

        let fullUrl = url + concat + 'appp=3&page=' + page + language;

        this.sendHttpGetWithNonce( fullUrl, userLogin, resolve, reject );

      })
    });
  }

  sendHttpGetWithNonce( url, userLogin, handleData, handleError ) {

    let nonceArg = this.getNonceArgIfExists( userLogin );

    this.sendHttpGet( url + nonceArg,
      res => {
        if( userLogin && !this.updateNonce(res, userLogin) ) {
          this.forceAppLogout();	// shouldn't happen normally. if nonce is bad, WP should return error, so should go straight to error handler. this is just for safety
        }
      },
      handleData,
      error => {
        if( this.errorDueToInvalidNonce(error) ) {
          this.forceAppLogout();
          this.sendHttpGetWithoutNonce( url, handleData, handleError );
        } else {
          handleError(error);
        }
      }
    );

  }

  errorDueToInvalidNonce( errorResponse ) {
    let contentType = errorResponse.headers.get('content-type');
    if(contentType && contentType.indexOf('application/json') >= 0) {
      return errorResponse.json()['code'] === 'rest_cookie_invalid_nonce';
    }
    return false;
  }

  sendHttpGetWithoutNonce( url, handleData, handleError ) {
    this.sendHttpGet( url,
      res => {},
      handleData,
      handleError
    );
  }

  sendHttpGet( url, preHandleResponse, handleData, handleError ) {

    this.http.get( url )
        .map(res => {
          preHandleResponse(res);
          return res.json();
        })
        .subscribe(data => {
          this.data = data;
          handleData(this.data);
        },
        error => {
          handleError(error);
        });

  }

  // for REST API calls, a logged in user is only considered logged in when has nonce.
  // so if nonce is missing, then reset login status too.
  forceAppLogout() {
    this.eventBus.publish('api:force_logout', {} )
  }

  getNonceArgIfExists(userLogin) {
    if(userLogin) {
      // on initial request, this should have come from the ajax login response (modified apppresser plugin)
      // on subsequent requests, this should have come from previous REST API response header
      let nonce = userLogin['my_wp_nonce'];
      if(nonce) {
        return '&_wpnonce=' + nonce;
      }
    }
    return '';
  }

  updateNonce(res, userLogin) {
    let updated = false;
    let headers = res.headers;
    if(headers) {
      // WP REST API generates this in response if it was an authenticated request
      let nonce = headers.get('x-wp-nonce');
      if(nonce) {
        userLogin['my_wp_nonce'] = nonce;
        updated = true;
      } else {
        userLogin['my_wp_nonce'] = null;
      }
      this.storage.set('userLogin', userLogin);
    }
    return updated;
  }

}

