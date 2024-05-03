import {useMemo} from 'react';
import {useLoaderData} from '@remix-run/react';
import {json} from '@shopify/remix-oxygen';
import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  getPaginationVariables,
  UNSTABLE_Analytics as Analytics,
} from '@shopify/hydrogen';
import {RenderSections} from '@pack/react';
import type {ProductCollectionSortKeys} from '@shopify/hydrogen/storefront-api-types';

import {Collection} from '~/components';
import {COLLECTION_QUERY, COLLECTION_PAGE_QUERY} from '~/data/queries';
import {getFilters, getShop, getSiteSettings} from '~/lib/utils';
import {routeHeaders} from '~/data/cache';
import {seoPayload} from '~/lib/seo.server';
import type {ActiveFilterValue} from '~/components/Collection/CollectionFilters/CollectionFilters.types';

export const headers = routeHeaders;

export async function loader({params, context, request}: LoaderFunctionArgs) {
  const {handle} = params;
  const {pack, storefront} = context;
  const pageData = await pack.query(COLLECTION_PAGE_QUERY, {
    variables: {handle},
    cache: storefront.CacheShort(),
  });

  const collectionPage = pageData.data?.collectionPage;

  const searchParams = new URL(request.url).searchParams;
  const siteSettings = await getSiteSettings(context);

  const {activeFilterValues, filters} = await getFilters({
    handle,
    searchParams,
    siteSettings,
    storefront,
  });

  const sortKey = String(
    searchParams.get('sortKey')?.toUpperCase() ?? 'COLLECTION_DEFAULT',
  ) as ProductCollectionSortKeys;
  const reverse = Boolean(searchParams.get('reverse') ?? false);

  const resultsPerPage = Math.floor(
    Number(
      siteSettings?.data?.siteSettings?.settings?.collection?.pagination
        ?.resultsPerPage,
    ) || 24,
  );

  const paginationVariables = getPaginationVariables(request, {
    pageBy: resultsPerPage,
  });

  const {collection} = await storefront.query(COLLECTION_QUERY, {
    variables: {
      handle,
      sortKey,
      reverse,
      filters,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
      ...paginationVariables,
    },
    cache: storefront.CacheShort(),
  });

  if (!collection) throw new Response(null, {status: 404});

  const shop = await getShop(context);
  const seo = seoPayload.collection({
    collection,
    page: collectionPage,
    shop,
    siteSettings,
    url: request.url,
  });

  return json({
    activeFilterValues,
    collection,
    collectionPage,
    seo,
  });
}

export default function CollectionRoute() {
  const {activeFilterValues, collection, collectionPage} =
    useLoaderData<typeof loader>();

  // determines if default collection heading should be shown
  // logic will apply once the hero section is saved and page is refreshed
  const hasVisibleHeroSection = useMemo(() => {
    if (!collectionPage) return false;
    const HERO_KEYS = ['hero', 'banner'];
    return collectionPage.sections.nodes.some(({data}: any) => {
      return HERO_KEYS.includes(data?._template);
    });
  }, [collectionPage]);

  return (
    <>
      <div data-comp={CollectionRoute.displayName}>
        {collectionPage && <RenderSections content={collectionPage} />}

        <section data-comp="collection">
          <Collection
            activeFilterValues={activeFilterValues as ActiveFilterValue[]}
            collection={collection}
            showHeading={!hasVisibleHeroSection}
          />
        </section>
      </div>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </>
  );
}

CollectionRoute.displayName = 'CollectionRoute';
