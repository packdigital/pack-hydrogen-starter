import {useLoaderData} from '@remix-run/react';
import {ProductProvider} from '@shopify/hydrogen-react';
import {json} from '@shopify/remix-oxygen';
import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {UNSTABLE_Analytics as Analytics} from '@shopify/hydrogen';
import {RenderSections} from '@pack/react';

import {
  formatGroupingWithOptions,
  getMetafields,
  getShop,
  getSiteSettings,
} from '~/lib/utils';
import type {Group, ProductWithGrouping} from '~/lib/types';
import {
  GROUPING_PRODUCT_QUERY,
  PRODUCT_GROUPINGS_QUERY,
  PRODUCT_PAGE_QUERY,
  PRODUCT_QUERY,
} from '~/data/queries';
import {Product} from '~/components';
import {routeHeaders} from '~/data/cache';
import {seoPayload} from '~/lib/seo.server';

/*
 * Add metafield queries to the METAFIELD_QUERIES array to fetch desired metafields for product pages
 * e.g. [{namespace: 'global', key: 'description'}, {namespace: 'product', key: 'seasonal_colors'}]
 */
const METAFIELD_QUERIES: {namespace: string; key: string}[] = [];

export const headers = routeHeaders;

export async function loader({params, context, request}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;
  const pageData = await context.pack.query(PRODUCT_PAGE_QUERY, {
    variables: {handle},
    cache: context.storefront.CacheShort(),
  });

  const productPage = pageData?.data?.productPage;

  const storeDomain = storefront.getShopifyDomain();
  const searchParams = new URL(request.url).searchParams;
  const selectedOptions: Record<string, any>[] = [];

  // set selected options from the query string
  searchParams.forEach((value, name) => {
    selectedOptions.push({name, value});
  });

  let {product: queriedProduct} = await storefront.query(PRODUCT_QUERY, {
    variables: {
      handle,
      selectedOptions,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
    cache: storefront.CacheShort(),
  });

  if (!queriedProduct) throw new Response(null, {status: 404});

  if (METAFIELD_QUERIES?.length) {
    const metafields = await getMetafields(context, {
      handle,
      metafieldQueries: METAFIELD_QUERIES,
    });
    queriedProduct = {...queriedProduct, metafields};
  }

  const groupingsData = await context.pack.query(PRODUCT_GROUPINGS_QUERY, {
    variables: {first: 100},
    cache: context.storefront.CacheShort(),
  });

  let grouping: Group = groupingsData?.data?.groups?.edges?.find(
    ({node}: {node: Group}) => {
      const groupingProducts = [
        ...node.products,
        ...node.subgroups.flatMap(({products}) => products),
      ];
      return groupingProducts.some(
        (groupProduct) => groupProduct.handle === handle,
      );
    },
  )?.node;

  if (grouping) {
    const productsToQuery = [
      ...grouping.products,
      ...grouping.subgroups.flatMap(({products}) => products),
    ];
    const groupingProductsPromises = productsToQuery.map(async (product) => {
      const data = await storefront.query(GROUPING_PRODUCT_QUERY, {
        variables: {
          handle: product.handle,
          country: storefront.i18n.country,
          language: storefront.i18n.language,
        },
        cache: storefront.CacheShort(),
      });
      return data.product;
    });

    let groupingProducts = await Promise.all(groupingProductsPromises);
    groupingProducts = groupingProducts.filter(Boolean);

    const groupingProductsByHandle = groupingProducts.reduce((acc, product) => {
      acc[product.handle] = product;
      return acc;
    }, {});
    groupingProductsByHandle[queriedProduct.handle] = queriedProduct;

    const groupingWithOptions = formatGroupingWithOptions({
      grouping,
      getProductByHandle: (handle) => groupingProductsByHandle[handle],
    });

    const groupingProductsByOptionValue = groupingProducts.reduce(
      (acc, groupProduct: ProductWithGrouping) => {
        groupProduct.options.forEach((option) => {
          const {name, values} = option;
          if (!values) return;
          values.forEach((value) => {
            if (!acc[name]) acc[name] = {};
            acc[name][value] = [...(acc[name][value] || []), groupProduct];
          });
        });
        return acc;
      },
      {},
    );

    grouping = {
      ...groupingWithOptions,
      productsByHandle: groupingProductsByHandle,
      productsByOptionValue: groupingProductsByOptionValue,
    } as Group;
  }

  const product = {
    ...queriedProduct,
    ...(grouping?.products.length || grouping?.subgroups.length
      ? {grouping}
      : null),
  };

  const selectedVariant = product.selectedVariant ?? product.variants?.nodes[0];

  delete product.selectedVariant;

  const shop = await getShop(context);
  const siteSettings = await getSiteSettings(context);
  const seo = seoPayload.product({
    product,
    selectedVariant,
    page: productPage,
    shop,
    siteSettings,
    url: request.url,
  });

  return json({
    product,
    productPage,
    selectedVariant,
    seo,
    storeDomain,
  });
}

export default function ProductRoute() {
  const {product, productPage, selectedVariant} =
    useLoaderData<typeof loader>();

  return (
    <>
      <ProductProvider
        data={product}
        initialVariantId={selectedVariant?.id || null}
      >
        <div data-comp={ProductRoute.displayName}>
          <Product product={product} />

          {productPage && <RenderSections content={productPage} />}
        </div>
      </ProductProvider>

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: product.selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: product.selectedVariant?.id || '',
              variantTitle: product.selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </>
  );
}

ProductRoute.displayName = 'ProductRoute';
