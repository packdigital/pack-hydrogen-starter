import {
  isRouteErrorResponse,
  Outlet,
  useMatches,
  useRouteError,
} from '@remix-run/react';
import type {ShouldRevalidateFunction} from '@remix-run/react';
import {defer} from '@shopify/remix-oxygen';
import type {LinksFunction, LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  ShopifySalesChannel,
  UNSTABLE_Analytics as Analytics,
  getShopAnalytics,
} from '@shopify/hydrogen';

import {ApplicationError, Document, NotFound, ServerError} from '~/components';
import {customerGetAction, validateCustomerAccessToken} from '~/lib/customer';
import {
  getEnvs,
  getProductGroupings,
  getShop,
  getSiteSettings,
} from '~/lib/utils';
import {registerSections} from '~/sections';
import {registerStorefrontSettings} from '~/settings';
import {seoPayload} from '~/lib/seo.server';
import styles from '~/styles/app.css';

registerSections();
registerStorefrontSettings();

// This is important to avoid re-fetching root queries on sub-navigations
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') {
    return true;
  }
  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) {
    return true;
  }
  return false;
};

export const links: LinksFunction = () => {
  return [
    {rel: 'stylesheet', href: styles},
    {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    },
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
    },
  ];
};

export async function loader({context, request}: LoaderFunctionArgs) {
  const {storefront, session, pack, env, cart} = context;
  const isPreviewModeEnabled = pack.isPreviewModeEnabled();

  const shop = await getShop(context);
  const siteSettings = await getSiteSettings(context);
  const customerAccessToken = await session.get('customerAccessToken');
  const groupingsPromise = getProductGroupings(context);

  const {isLoggedIn, headers} = await validateCustomerAccessToken(
    session,
    customerAccessToken,
  );
  let customer = null;
  if (isLoggedIn) {
    const {data: customerData} = await customerGetAction({context});
    if (customerData.customer) {
      customer = customerData.customer;
    }
  }

  const analytics = {
    shopifySalesChannel: ShopifySalesChannel.hydrogen,
    shopId: shop.id,
  };
  const seo = seoPayload.root({
    shop,
    siteSettings,
    url: request.url,
  });
  const ENV = await getEnvs(context);
  const SITE_TITLE = siteSettings?.data?.siteSettings?.seo?.title || shop.name;
  const SITE_LOGO = shop.brand.logo?.image?.url;

  return defer(
    {
      analytics,
      customer,
      customerAccessToken,
      customizerMeta: pack.preview?.session.get('customizerMeta'),
      ENV: {...ENV, SITE_LOGO, SITE_TITLE} as Record<string, string>,
      groupingsPromise,
      isPreviewModeEnabled,
      selectedLocale: storefront.i18n,
      seo,
      siteSettings,
      siteTitle: SITE_TITLE,
      url: request.url,
      shop: getShopAnalytics({
        storefront,
        publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
      }),

      consent: {
        checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
        storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      },
    },
    {headers},
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const routeError = useRouteError();
  const isRouteError = isRouteErrorResponse(routeError);
  const [root] = useMatches();

  if (!root?.data) return <ServerError error={routeError} />;

  const title = isRouteError ? 'Not Found' : 'Application Error';

  return (
    <Document title={title}>
      {isRouteError ? <NotFound /> : <ApplicationError error={routeError} />}
    </Document>
  );
}
