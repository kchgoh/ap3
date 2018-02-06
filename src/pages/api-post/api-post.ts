import {NavController, NavParams, Events, LoadingController, ToastController, ModalController, Platform, ViewController, IonicPage} from 'ionic-angular';
import {Component, Renderer, ElementRef, OnInit, ViewChild} from '@angular/core';
import {AuthPosts} from '../../providers/posts/auth-posts';
import {DomSanitizer} from '@angular/platform-browser';
import {SocialSharing} from '@ionic-native/social-sharing';
import {Storage} from '@ionic/storage';

import {MediaPlayer} from '../media-player/media-player';
import { VideoUtils } from "../../providers/video/video-utils";

@IonicPage()
@Component({
  templateUrl: 'api-post.html'
})
export class ApiPost implements OnInit {
  selectedItem: any;
  content: any;
  listenFunc: Function;
  rtlBack: boolean = false;
  showShare: boolean = true;
  rootRoute: string;
  postRoute: string;
  requireLogin: boolean = false;

  @ViewChild('mycontent')
  myContent : ElementRef;

  constructor(
    public nav: NavController, 
    public navParams: NavParams, 
    public eventBus: Events,
    public postService: AuthPosts, 
    public sanitizer: DomSanitizer,
    public loadingController: LoadingController, 
    public toastCtrl: ToastController,
    public modalCtrl: ModalController,
    public renderer: Renderer,
    public elementRef: ElementRef,
    public viewCtrl: ViewController,
    public platform: Platform,
    public storage: Storage, 
    private SocialSharing: SocialSharing,
    private videoUtils: VideoUtils
    ) {
 
    this.rootRoute = this.navParams.data.root_route;
    let slug = this.navParams.data.slug;
    this.postRoute = this.rootRoute + '/posts?slug=' + slug;

    this.listenFunc = renderer.listen(elementRef.nativeElement, 'click', (event) => {

      let link = this.determineClickLink( event.target );
      if( link.type == ClickLinkType.Anchor ) {

        let elem = this.myContent.nativeElement.querySelector(link.info);
        //elem.scrollIntoView();    // this is the simplest way but it's a straight jump and sometimes don't work. so use scroll instead
        this.smoothScrollTo( elem );
        event.preventDefault();

      } else if( link.type == ClickLinkType.Slug ) {

        event.preventDefault();

        this.nav.push( 'ApiPost', {
          root_route: this.rootRoute,
          slug: link.info
        }, {});

      } else {	// EXTERNAL
        this.iabLinks( event.target )
      }

    });

    if( platform.is('android') ) {
      this.videoUtils.killVideos(this.elementRef);
    }

  }

  smoothScrollTo( elem ) {
    let curr = elem.offsetParent.scrollTop;
    this.smoothScrollTo2( elem.offsetParent, curr + 10, elem.offsetTop, 300 );
  }

  smoothScrollTo2( elem, value, target, time ) {
    if( value >= target ) {
      return;
    }
    const tick = 10;
    let move = ( target - value ) / time * tick;
    elem.scrollTop = value;
    setTimeout(() => {
      this.smoothScrollTo2( elem, value + move, target, time - tick );
    }, tick);
  }

  ngOnInit() {
    let myappp: any = localStorage.getItem('myappp');
    if(myappp) {
        if(typeof myappp == 'string')
            myappp = JSON.parse(myappp);
    
        if(myappp && myappp.meta && myappp.meta.share && myappp.meta.share.icon && myappp.meta.share.icon.hide)
            this.showShare = (myappp.meta.share.icon.hide) ? false : true;
    }

    this.loadPost( this.postRoute );
  }

  loadPost( route ) {

    let loading = this.loadingController.create({
        showBackdrop: false,
    });

    loading.present(loading);

    this.postService.load( route, 1 ).then(items => {

      if((<any>items).length < 1) {
        loading.dismiss();
        console.error('Article not found: ' + route);
        this.presentToast('Article not found');
      };

      this.selectedItem = items[0];

      this.storage.get('user_login').then( userLogin => {

        if(userLogin && userLogin['my_wp_nonce']) {
          this.requireLogin = false;
          this.content = this.sanitizer.bypassSecurityTrustHtml( this.selectedItem.content.rendered );
        } else {
          this.requireLogin = true;
        }

        loading.dismiss();

      } );

    }).catch((err) => {
      loading.dismiss();
      console.error('Error getting post', err);
      this.presentToast('Error getting post.');
    });

    setTimeout(() => {
        loading.dismiss();
    }, 8000);

  }

  presentToast(msg) {

    let toast = this.toastCtrl.create({
      message: msg,
      duration: 3000,
      position: 'bottom'
    });

    toast.onDidDismiss(() => {
      // console.log('Dismissed toast');
    });

    toast.present();

  }

  determineClickLink( el ): ClickLinkInfo {

    if( el.href ) {
      let targetUrl = new URL(el.href);
      if( targetUrl.protocol === 'file:' && targetUrl.hash !== '' ) {
        return {
          type: ClickLinkType.Anchor,
          info: targetUrl.hash
        };
      }

      if( targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:' ) {
        if(targetUrl.pathname === '/' && targetUrl.hash !== '') {
          return {
            type: ClickLinkType.Anchor,
            info: targetUrl.hash
          };
        }

        let postUrl = new URL(this.postRoute);
        if( postUrl.host === targetUrl.host ) {
          let parts = targetUrl.pathname.split('/');
          let targetSlug = parts.pop();
          // sometimes there is a trailing slash, so last item is blank. then use one before
          if(targetSlug === '') {
            return {
              type: ClickLinkType.Slug,
              info: parts.pop()
            };
          }

          return {
            type: ClickLinkType.Slug,
            info: targetSlug
          };
        }
      }
    }
    return { type: ClickLinkType.External, info: '' };
  }

  iabLinks( el ) {

    var target = '_blank'
      
    if( el.href && el.href.indexOf('http') >= 0 ) {

      if( el.classList && el.classList.contains('system') )
        target = '_system'

      event.preventDefault()
      window.open( el.href, target )

    } else if( el.tagName == 'IMG' && el.parentNode.href && el.parentNode.href.indexOf('http') >= 0 ) {

      // handle image tags that have link as the parent
      if( el.parentNode.classList && el.parentNode.classList.contains('system') )
        target = '_system'

      event.preventDefault()
      window.open( el.parentNode.href, target )

    }

  }

  ionViewWillEnter() {

    if( this.platform.isRTL && this.viewCtrl.enableBack() ) {
        this.viewCtrl.showBackButton(false)
        this.rtlBack = true
    }
 
  }

  mediaModal( src, img = null ) {

    let modal = this.modalCtrl.create(MediaPlayer, {source: src, image: img});
    modal.present();

  }

  share() {

    this.SocialSharing.share( this.selectedItem.title.rendered, null, null, this.selectedItem.link ).then(() => {
      // Sharing via email is possible
    }).catch(() => {
      // Sharing via email is not possible
    });

  }

  // changes the back button transition direction if app is RTL
  backRtlTransition() {
    let obj = {}

    if( this.platform.is('ios') )
      obj = {direction: 'forward'}
    
    this.nav.pop( obj )
  }

  openSearch() {
    this.eventBus.publish('opensearch', {} )
  }

  openLogin() {
    this.eventBus.publish('login:force_login', {} )
  }
}

enum ClickLinkType { Anchor, Slug, External }

interface ClickLinkInfo {
	type: ClickLinkType;
	info: string;
}

