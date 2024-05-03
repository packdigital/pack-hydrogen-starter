import {json} from '@shopify/remix-oxygen';
import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  AnalyticsPageType,
  UNSTABLE_Analytics as Analytics,
} from '@shopify/hydrogen';

import {CartPage} from '~/components';
import {getShop, getSiteSettings} from '~/lib/utils';
import type {Page} from '~/lib/types';
import {seoPayload} from '~/lib/seo.server';

export async function loader({context}: LoaderFunctionArgs) {
  const shop = await getShop(context);
  const siteSettings = await getSiteSettings(context);
  const analytics = {pageType: AnalyticsPageType.cart};
  const seo = seoPayload.page({
    page: {title: 'Cart'} as Page,
    shop,
    siteSettings,
  });
  return json({analytics, seo});
}

export default function CartRoute() {
  return (
    <>
      <CartPage /> <Analytics.CartView />
    </>
  );
}

CartRoute.displayName = 'CartRoute';
