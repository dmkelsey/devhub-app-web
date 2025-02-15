import React, { useState } from 'react';
import isNull from 'lodash/isNull';
import uniqBy from 'lodash/uniqBy';
import intersectionBy from 'lodash/intersectionBy';
import queryString from 'query-string';

import { RESOURCE_TYPES } from '../constants/ui';
import DEFAULT_FILTERS, { FILTER_QUERY_PARAM } from '../constants/filterGroups';
import { SEARCH_QUERY_PARAM } from '../constants/search';

import { flattenGatsbyGraphQL } from '../utils/dataHelpers';
import { RESOURCE_TYPE_PAGES } from '../messages';

// components
import Filters from '../components/Filters/Filters';
import Layout from '../hoc/Layout';
import withResourceQuery from '../hoc/withResourceQuery';
import { CardsContainer, PageContainer, Title, Main, FilterMenu } from '../components/Page';
import SideDrawer from '../components/SideDrawer/SideDrawer';
import NoResources from '../components/UI/NoResources/NoResources';
import Aux from '../hoc/auxillary';

// selectors from reselect
import { selectResourcesGroupedByType } from '../utils/selectors';

import { useSearch } from '../utils/hooks';
import { isQueryEmpty } from '../utils/search';
import {
  filterResources,
  setFilterPropsBasedOnResourceCounts,
  isFilterLonely,
} from '../utils/helpers';

// create a selector instance from the selectResourcesGroupedByType
const resourcesSelector = selectResourcesGroupedByType();

// generic template page where all 'resource type' pages are generated from
export const ResourceType = ({
  data: {
    allDevhubSiphon,
    siteSearchIndex: { index },
  },
  pageContext, // received from gatsby create pages api, view gatsby/createPages.js for more info
  location,
}) => {
  const [sideDrawerToggled, setSideDrawerToggled] = useState(false);

  const queryParam = queryString.parse(location.search);
  let query = []; // the search query ie ?q=foo
  let results = []; // the search results if any
  let filters = []; // the filter queury ie ?f=bar&f=foo
  let windowHasQuery = Object.prototype.hasOwnProperty.call(queryParam, SEARCH_QUERY_PARAM);
  let windowHasFilters = Object.prototype.hasOwnProperty.call(queryParam, FILTER_QUERY_PARAM);
  // if window has ?q= value
  if (windowHasQuery) {
    query = decodeURIComponent(queryParam[SEARCH_QUERY_PARAM]);
  } else {
    query = '';
  }

  results = useSearch(query, index);
  // this is defined by ?q='' or ?q=''&q=''..etc
  // if query is empty we prevent the search results empty from being rendered
  // in addition the collections container is prevented from not rendering because
  // the query is present
  const queryIsEmpty = isQueryEmpty(query);

  const resourceTypeConst = RESOURCE_TYPES[pageContext.resourceTypeConst];

  const resourcesByType = resourcesSelector(flattenGatsbyGraphQL(allDevhubSiphon.edges));

  if (windowHasFilters) {
    filters = decodeURIComponent(queryParam[FILTER_QUERY_PARAM]).split(',');
  }
  // grab the specific resources by the resource type associated with this pages context
  let resources = resourcesByType[resourceTypeConst].map(r => ({
    type: r.resource.type,
    title: r.unfurl.title,
    description: r.unfurl.description,
    image: r.unfurl.image,
    path: r.resource.path,
    id: r.id,
    ...r,
  }));

  const resourcesExist = resourcesByType[resourceTypeConst].length > 0;

  // interesect search results with resources
  if (results && !isNull(results) && results.length > 0) {
    // diff out resources by id
    resources = intersectionBy(resources, results, 'id');
  }

  const resourcesNotFound = !queryIsEmpty && (!results || (results.length === 0 && windowHasQuery));
  // map properties like availableResources and isFilterable to filtergroups based on the current set
  // of resources
  let filterGroups = DEFAULT_FILTERS.map(f => setFilterPropsBasedOnResourceCounts(f, resources));
  // if only one filter isFilterable unset it to false because there is no point in having it togglable
  // in the ui
  if (isFilterLonely(filterGroups) || resourcesNotFound) {
    filterGroups = filterGroups.map(f => ({ ...f, isFilterable: false }));
  }

  //remove duplicates from the resources
  //note: resources in many collections will only be shown in one of their many contexts
  resources = uniqBy(resources, 'title');

  if (resourcesExist && windowHasFilters) {
    // filters are an array of keys as plain strings ['key1', 'key2']
    // convert filters into and array of objects with a key props so that it is similar to DEFAULT_FILTER's schema
    // this will allow an intersection to work
    const filtersWithKeys = filters.map(f => ({ key: f }));
    // get active filters by filter keys
    const activeFilters = intersectionBy(filterGroups, filtersWithKeys, 'key');
    resources = filterResources(resources, activeFilters);
  }

  return (
    <Layout>
      <Main role="main">
        <Title
          title={RESOURCE_TYPE_PAGES[pageContext.resourceType].header.title.defaultMessage}
          subtitle={RESOURCE_TYPE_PAGES[pageContext.resourceType].header.subtitle.defaultMessage}
        />
        <PageContainer>
          {resourcesExist ? (
            <Aux>
              <FilterMenu filters={filterGroups} />
              <CardsContainer
                searchResultsEmpty={resourcesNotFound}
                pagePath={location.pathname}
                resources={resources}
                query={query}
                openSideDrawer={() => setSideDrawerToggled(true)}
              />
            </Aux>
          ) : (
            <NoResources />
          )}
        </PageContainer>
      </Main>
      <SideDrawer
        show={sideDrawerToggled}
        closeDrawer={() => setSideDrawerToggled(false)}
        title="Filters"
      >
        <Filters filters={filterGroups} />
      </SideDrawer>
    </Layout>
  );
};

export default withResourceQuery(ResourceType)();
