import {NavController, NavParams, ToastController, ItemSliding, Platform, ViewController, Content, IonicPage} from 'ionic-angular';
import {Component, ViewChild, OnInit, Input} from '@angular/core';
import {AuthPosts} from '../../providers/posts/auth-posts';
import {GlobalVars} from '../../providers/globalvars/globalvars';
import {HeaderLogo} from '../../providers/header-logo/header-logo';
import {Storage} from '@ionic/storage';
import {Device} from '@ionic-native/device';
import {Network} from '@ionic-native/network';

@IonicPage()
@Component({
  templateUrl: 'search-page.html'
})
export class SearchPage implements OnInit {

  @ViewChild(Content) content: Content;

  selectedItem: any;
  icons: string[];
  items: any;
  slides: any;
  page: number = 1;
  siteurl: string;
  route: string;
  title: string;
  defaultlist: boolean = false
  cardlist: boolean = false;
  showSlider: boolean = false;
  showSearch: boolean = false;
  rtlBack: boolean = false;
  networkState: any;
  header_logo_url: string;
  show_header_logo: boolean = false;
  customClasses: string = '';
  isShowSpinner: boolean = false;

  constructor(
    public nav: NavController, 
    public navParams: NavParams, 
    public postService: AuthPosts, 
    public globalvars: GlobalVars, 
    public storage: Storage, 
    public toastCtrl: ToastController,
    public viewCtrl: ViewController,
    public platform: Platform,
    private headerLogoService: HeaderLogo,
    private Network: Network,
    private Device: Device
  ) {

    this.route = navParams.data.list_route;

    this.title = navParams.data.title;

    if(navParams.data.is_home == true) {
      this.doLogo()
    }

    this.defaultlist = true;

    this.previewAlert(this.route);

    // TODO
    this.customClasses = 'post-list' + ((navParams.data.slug) ? ' page-' + navParams.data.slug : '');
    
  }

  ngOnInit() {
  }

  ionViewWillEnter() {

    if( this.platform.isRTL && this.viewCtrl.enableBack() ) {
        this.viewCtrl.showBackButton(false)
        this.rtlBack = true
    }

  }

  showSpinner() {
    this.isShowSpinner = true;
  }

  hideSpinner() {
    this.isShowSpinner = false;
  }

  loadPosts( route ) {

    // KG: do not use LoadingController because it steals the focus from the searchbar.
    // user could be still typing, and then suddenly the keyboard is gone when focus is taken away.
    // instead just do a simple show/hide spinner, let focus remain in the searchbar.

    this.showSpinner();

    this.page = 1;
    
    // any menu imported from WP has to use same component. Other pages can be added manually with different components
    this.postService.load( route, this.page ).then(items => {

      // Loads posts from WordPress API
      this.items = items;

      // KG: for search, don't store
      //this.storage.set( route.substr(-10, 10) + '_posts', items);

      // load more right away
      this.loadMore(null);
      this.hideSpinner();
    }).catch((err) => {
      this.hideSpinner();
      console.error('Error getting posts', err);
      this.presentToast('Error getting posts.');
    });

    setTimeout(() => {
      this.hideSpinner();
    }, 8000);

  }

  itemTapped(event, item) {

    let opt = {};

    // TODO somehow this causes error. to investigate
//    if( this.platform.isRTL && this.platform.is('ios') )
//      opt = { direction: 'back' }

    // use new api page
	let pathIndex = this.route.lastIndexOf('/');
	let root = this.route.substring(0, pathIndex);
    this.nav.push( 'ApiPost', {
      root_route: root,
      slug: item.slug
    }, opt);
  }


  search(ev) {
    // set val to the value of the searchbar
    let val = ev.target.value;

    // if the value is an empty string don't filter the items
    if (val && val.trim() != '') {
      // set to this.route so infinite scroll works
      this.route = this.addQueryParam(this.navParams.data.list_route, 'search=' + val);
      this.loadPosts( this.route )
    }

  }

  addQueryParam(url, param) {
    const separator = (url.indexOf('?') > 0) ? '&' : '?';
    return url + separator + param;
  }

  clearSearch() {
    this.items = [];
  }

  loadMore(infiniteScroll) {

    this.page++;

    this.postService.load( this.route, this.page ).then(items => {
      // Loads posts from WordPress API
      let length = items["length"];

      if( length === 0 ) {
        if(infiniteScroll)
          infiniteScroll.complete();
        return;
      }

      for (var i = 0; i < length; ++i) {
        this.items.push( items[i] );
      }

      this.storage.set( this.route.substr(-10, 10) + '_posts', this.items);

      if(infiniteScroll)
        infiniteScroll.complete();

    }).catch( e => {
      // promise was rejected, usually a 404 or error response from API
      if(infiniteScroll)
        infiniteScroll.complete();

      console.warn(e)

    });

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

  // Show alert in preview if not using https
  previewAlert(url) {

    if(!url) {
      return;
    }

    if( this.Device.platform != 'iOS' && this.Device.platform != 'Android' && url.indexOf('http://') >= 0 ) {
          alert('Cannot display http pages in browser preview. Please build app for device or use https.');
      }

  }

  // get data for slides
  loadSlides( route ) {

    this.postService.load( route , '1' ).then(slides => {

      // Loads posts from WordPress API
      this.slides = slides;
      this.showSlider = true;

    }).catch((err) => {

      this.showSlider = false;
      console.error('Error getting posts', err);

    });

  }

  // changes the back button transition direction if app is RTL
  backRtlTransition() {
    let obj = {}

    if( this.platform.is('ios') )
      obj = {direction: 'forward'}
    
    this.nav.pop( obj )
  }

  doLogo() {
    // check if logo file exists. If so, show it
    this.headerLogoService.checkLogo().then( data => {
      this.show_header_logo = true
      this.header_logo_url = (<string>data)
    }).catch( e => {
      // no logo, do nothing
      //console.log(e)
    })
  }

}
