import {json} from '@shopify/remix-oxygen';
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {useLoaderData} from '@remix-run/react';
import {
  getPaginationVariables,
  UNSTABLE_Analytics as Analytics,
} from '@shopify/hydrogen';
import type {
  Collection as CollectionType,
  SearchSortKeys,
} from '@shopify/hydrogen/storefront-api-types';

import {Collection} from '~/components';
import {PRODUCTS_SEARCH_QUERY} from '~/data/queries';
import {getFilters, getShop, getSiteSettings} from '~/lib/utils';
import type {Page} from '~/lib/types';
import {seoPayload} from '~/lib/seo.server';
import type {ActiveFilterValue} from '~/components/Collection/CollectionFilters/CollectionFilters.types';

export async function action({request, context}: ActionFunctionArgs) {
  const {storefront} = context;
  const searchParams = new URL(request.url).searchParams;

  let body;
  try {
    body = await request.formData();
  } catch (error) {
    return json(
      {searchResults: null, searchTerm: null, errors: ['Invalid form data']},
      {status: 400},
    );
  }

  const searchTerm = String(body?.get('q') || searchParams.get('q') || '');

  if (!searchTerm)
    return json({
      searchResults: {results: null, totalResults: 0},
      searchTerm,
      searchTypes: ['PRODUCT'],
    });

  const count = Number(body?.get('count') || searchParams.get('count')) || 10;

  const {search} = await storefront.query(PRODUCTS_SEARCH_QUERY, {
    variables: {
      searchTerm,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
      first: count,
    },
    cache: storefront.CacheShort(),
  });

  return json({
    searchResults: {
      results: search.nodes || null,
      totalResults: search.totalCount ?? 0,
    },
    searchTerm,
    searchTypes: ['PRODUCT'],
  });
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const {storefront} = context;
  const siteSettings = await getSiteSettings(context);
  const resultsPerPage = parseInt(
    String(
      siteSettings?.data?.siteSettings?.settings?.collection?.pagination
        ?.resultsPerPage || '24',
    ),
    10,
  );
  const searchParams = new URL(request.url).searchParams;
  const searchTerm = String(searchParams.get('q') ?? '');

  const {activeFilterValues, filters} = await getFilters({
    searchParams,
    searchTerm,
    siteSettings,
    storefront,
  });

  const sortKey = String(
    searchParams.get('sortKey')?.toUpperCase() ?? 'RELEVANCE',
  ) as SearchSortKeys;
  const reverse = Boolean(searchParams.get('reverse') ?? false);

  const paginationVariables = getPaginationVariables(request, {
    pageBy: resultsPerPage,
  });

  const {search} = await storefront.query(PRODUCTS_SEARCH_QUERY, {
    variables: {
      searchTerm,
      sortKey,
      reverse,
      filters,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
      ...paginationVariables,
    },
    cache: storefront.CacheShort(),
  });

  const productsLength = search.nodes.length;

  const collection = {
    id: 'search',
    title: productsLength
      ? `Found ${search.totalCount} ${filters.length ? 'filtered ' : ''}${
          search.totalCount === 1 ? 'result' : 'results'
        } for "${searchTerm}"`
      : filters.length
      ? `Found 0 filtered results for "${searchTerm}"`
      : `Found no results for "${searchTerm}"`,
    handle: 'search',
    descriptionHtml: 'Search results',
    description: 'Search results',
    seo: {
      title: 'Search',
      description: `Search results for "${searchTerm}"`,
    },
    metafields: [],
    products: search,
    updatedAt: new Date().toISOString(),
  } as CollectionType;

  const shop = await getShop(context);
  const seo = seoPayload.collection({
    collection,
    page: {} as Page,
    shop,
    siteSettings,
    url: request.url,
  });

  return json({
    activeFilterValues,
    collection,
    searchTerm,
    seo,
  });
}

export default function SearchRoute() {
  const {activeFilterValues, collection, searchTerm} =
    useLoaderData<typeof loader>();

  return (
    <>
      <section data-comp="search-page" className="[&_h1]:text-title-h3">
        <Collection
          activeFilterValues={activeFilterValues as ActiveFilterValue[]}
          collection={collection}
          searchTerm={searchTerm}
          showHeading
        />
      </section>
      <Analytics.SearchView
        data={{searchTerm, searchResults: collection.products}}
      />
    </>
  );
}

SearchRoute.displayName = 'SearchRoute';
