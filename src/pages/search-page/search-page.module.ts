import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TranslateModule } from '@ngx-translate/core';
import { SearchPage } from './search-page';

@NgModule({
  declarations: [
    SearchPage,
  ],
  imports: [
    IonicPageModule.forChild(SearchPage),
    TranslateModule.forChild()
  ],
  exports: [
    SearchPage
  ]
})
export class SearchPageModule {}
