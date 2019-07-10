import fs from 'fs';
import path from 'path';

import { google } from '../compiled/google-proto';
import { GaClientError } from './error-parsing-interceptor';

const GoogleAdsFailure = google.ads.googleads.v2.errors.GoogleAdsFailure;

it('can present google error message from metadata', () => {
  const failureMetadataBytes = fs.readFileSync(path.join(__dirname, 'failure.pb'));
  const obj = GoogleAdsFailure.decode(failureMetadataBytes);

  const err = new GaClientError([obj]);

  expect(err.message).toMatchSnapshot();
});
