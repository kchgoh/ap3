import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TranslateModule } from '@ngx-translate/core';
import { ApiPost } from './api-post';
import { SanitizeHtmlModule } from '../../pipes/sanitize-html/sanitize-html.module';

@NgModule({
  declarations: [
    ApiPost,
  ],
  imports: [
    IonicPageModule.forChild(ApiPost),
    TranslateModule.forChild(),
    SanitizeHtmlModule
  ],
  exports: [
    ApiPost
  ]
})
export class ApiPostModule {}
