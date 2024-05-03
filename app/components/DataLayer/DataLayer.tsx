import {Script, useNonce} from '@shopify/hydrogen';

import {useLocale, useRootLoaderData} from '~/hooks';

import {
  useDataLayerAccount,
  useDataLayerCart,
  useDataLayerCollection,
  useDataLayerCustomer,
  useDataLayerEvent,
  useDataLayerInit,
  useDataLayerProduct,
  useDataLayerSearch,
  useDataLayerSubscribe,
} from './hooks';

/*
 * Env to set, only if applicable:
 * PUBLIC_ELEVAR_SIGNING_KEY // enables Elevar data layer, e.g. 1234567890
 * --> from the url within the `fetch()` call in the script, take the unique string of characters in between `/configs/` and `/config.json`
 * PUBLIC_GA4_TAG_ID // enables GA4 analytics, e.g. G-XXXXXXXXXX
 */

const DEBUG = true;

export function DataLayer() {
  const {ENV} = useRootLoaderData();
  const nonce = useNonce();
  const {currency: currencyCode} = useLocale();
  const {handleDataLayerEvent} = useDataLayerEvent({DEBUG, ENV});

  const {generateUserProperties, userProperties} = useDataLayerInit({
    handleDataLayerEvent,
  });

  const {userDataEvent, userDataEventTriggered} = useDataLayerCustomer({
    currencyCode,
    handleDataLayerEvent,
    userProperties,
  });

  useDataLayerAccount({
    currencyCode,
    generateUserProperties,
    handleDataLayerEvent,
    userDataEvent,
    userDataEventTriggered,
  });

  useDataLayerCart({
    currencyCode,
    handleDataLayerEvent,
    userDataEvent,
    userDataEventTriggered,
    userProperties,
  });

  useDataLayerProduct({
    handleDataLayerEvent,
    userDataEvent,
    userProperties,
  });

  useDataLayerCollection({
    handleDataLayerEvent,
    userDataEvent,
    userDataEventTriggered,
    userProperties,
  });

  useDataLayerSearch({
    handleDataLayerEvent,
    userDataEvent,
    userDataEventTriggered,
    userProperties,
  });

  useDataLayerSubscribe({
    handleDataLayerEvent,
    userDataEventTriggered,
  });

  if (ENV?.PUBLIC_ELEVAR_SIGNING_KEY) {
    return (
      <Script
        nonce={nonce}
        type="module"
        id="elevar-script"
        dangerouslySetInnerHTML={{
          __html: `try {
            const response = await fetch("${`https://shopify-gtm-suite.getelevar.com/configs/${ENV?.PUBLIC_ELEVAR_SIGNING_KEY}/config.json`}");
            const config = await response.json();
            const scriptUrl = config.script_src_custom_pages;

            if (scriptUrl) {
              const { handler } = await import(scriptUrl);
              await handler(config);
            }
          } catch (error) {
            console.error("Elevar Error:", error);
        }`,
        }}
      />
    );
  }

  if (ENV?.PUBLIC_GA4_TAG_ID) {
    return (
      <>
        <Script
          nonce={nonce}
          id="gtag-script"
          type="text/javascript"
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${ENV.PUBLIC_GA4_TAG_ID}`}
        />

        <Script
          nonce={nonce}
          id="gtag-config"
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ENV.PUBLIC_GA4_TAG_ID}');
            `,
          }}
        />
      </>
    );
  }

  return null;
}

DataLayer.displayName = 'DataLayer';
