import type {AppLoadContext, EntryContext} from '@shopify/remix-oxygen';
import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

const localDirectives =
  process.env.NODE_ENV === 'development'
    ? ['localhost:*', 'ws://localhost:*', 'ws://127.0.0.1:*']
    : [];

const parseCookies = (cookieHeader: string | null) => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies: any, cookie: string) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  const headers = request.headers.get('Cookie');
  const cookies = parseCookies(headers);
  const isPreview = cookies['__preview'];

  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    // Custom CSP policies
    // Modify these policies if adding new 3rd party resources
    ...(isPreview
      ? {
          frameAncestors: ['*.packdigital.com'],
        }
      : null),
    defaultSrc: [
      'data:',
      '*.youtube.com',
      '*.youtu.be',
      '*.vimeo.com',
      '*.google.com',
      '*.google-analytics.com',
      '*.googletagmanager.com',
      'fonts.gstatic.com',
      ...localDirectives,
    ],
    imgSrc: ['*', ...localDirectives],
    scriptSrc: [
      'google.com',
      'googletagmanager.com',
      '*.shopify.com',
      'shopify.com',
      '*.cloudfront.net',
      ...localDirectives,
    ],
    styleSrc: ['fonts.googleapis.com', '*.jsdelivr.net', ...localDirectives],
    connectSrc: ['*.google-analytics.com', ...localDirectives],
    shop: {
      checkoutDomain: context.env?.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env?.PUBLIC_STORE_DOMAIN,
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
