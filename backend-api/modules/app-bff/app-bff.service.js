const analytics = require('../analytics/analytics.service');
const routeService = require('../route/route.service');
const busService = require('../bus/bus.service');
const tourism = require('../tourism/tourism.service');
const trip = require('../trip/trip.service');
const community = require('../community/community.service');
const stop = require('../stop/stop.service');

async function dashboard() {
  const [summary, routes, buses, places, posts] = await Promise.all([analytics.summary(), routeService.listRoutes(), busService.listBuses(), tourism.recommended({}), community.list({})]);
  return { summary, routes, buses, recommendedPlaces: places.slice(0, 6), communityPosts: posts.slice(0, 3) };
}
async function placeDiscovery(query) { return { places: await tourism.search(query), categories: await tourism.categories() }; }
async function placeDetail(id, query) { return tourism.detail(id, query); }
async function tripPlannerOptions() { return trip.options(); }
async function tripGenerate(body) { return trip.generate(body, null, false); }
async function chatContext(query) {
  const nearestStop = query.lat && query.lng ? await stop.findNearest(query) : null;
  const places = await tourism.recommended(query);
  return { nearestStop, suggestedPlaces: places.slice(0, 5), examples: ['Tôi muốn đến Hội An', 'Tôi muốn đi biển bằng xe buýt', 'Review Bà Nà Hills thế nào?', 'Tôi có 1 buổi chiều thì nên đi đâu?'] };
}
module.exports = { dashboard, placeDiscovery, placeDetail, tripPlannerOptions, tripGenerate, chatContext };
