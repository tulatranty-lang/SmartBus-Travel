const { query } = require('../../config/db');

async function savePlan(userId, input, items) {
  const rs = await query(`
    INSERT INTO trip_plans(user_id, title, time_available, interests, budget)
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.title, INSERTED.time_available AS timeAvailable,
           INSERTED.interests, INSERTED.budget, INSERTED.created_at AS createdAt
    VALUES(@userId, @title, @timeAvailable, @interests, @budget)
  `, {
    userId: userId || null,
    title: input.title || 'Lịch trình SmartBus',
    timeAvailable: input.timeAvailable || null,
    interests: Array.isArray(input.interests) ? input.interests.join(',') : input.interests || null,
    budget: input.budget || null,
  });
  const plan = rs.recordset[0];
  for (const [idx, item] of items.entries()) {
    await query(`
      INSERT INTO trip_plan_items(trip_plan_id, sequence_no, place_id, route_code, stop_id, estimated_stay_minutes)
      VALUES(@planId, @sequenceNo, @placeId, @routeId, @stopId, @estimatedStayMinutes)
    `, {
      planId: plan.id,
      sequenceNo: idx + 1,
      placeId: item.id || null,
      routeId: item.recommendedRoute?.id || item.nearestStop?.routeId || null,
      stopId: item.nearestStop?.stopId ? Number(item.nearestStop.stopId) : null,
      estimatedStayMinutes: item.suggestedDurationMinutes || null,
    });
  }
  return { ...plan, items };
}

async function myPlans(userId) {
  const rs = await query(`
    SELECT id, user_id AS userId, title, time_available AS timeAvailable, interests, budget, created_at AS createdAt
    FROM trip_plans
    WHERE user_id=@userId
    ORDER BY created_at DESC
  `, { userId: Number(userId) });
  return rs.recordset;
}

async function detail(id, userId) {
  const rs = await query(`
    SELECT TOP 1 id, user_id AS userId, title, time_available AS timeAvailable, interests, budget, created_at AS createdAt
    FROM trip_plans
    WHERE id=@id AND user_id=@userId
  `, { id: Number(id), userId: userId ? Number(userId) : null });
  const plan = rs.recordset[0];
  if (!plan) return null;
  const items = await query(`
    SELECT i.id, i.trip_plan_id AS tripPlanId, i.sequence_no AS sequenceNo, i.place_id AS placeId,
           p.name AS placeName, i.route_code AS routeId, i.stop_id AS stopId,
           i.estimated_stay_minutes AS estimatedStayMinutes
    FROM trip_plan_items i
    LEFT JOIN tourist_places p ON p.id=i.place_id
    WHERE i.trip_plan_id=@id
    ORDER BY i.sequence_no
  `, { id: Number(id) });
  return { ...plan, items: items.recordset };
}

async function remove(id, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return null;
  const exists = await query('SELECT TOP 1 id FROM trip_plans WHERE id=@id AND user_id=@userId', { id: Number(id), userId: uid });
  if (!exists.recordset[0]) return null;
  await query(`
    DELETE items
    FROM trip_plan_items items
    JOIN trip_plans plans ON items.trip_plan_id = plans.id
    WHERE plans.id=@id AND plans.user_id=@userId
  `, { id: Number(id), userId: uid });
  const rs = await query(`
    DELETE FROM trip_plans
    OUTPUT DELETED.id
    WHERE id=@id AND user_id=@userId
  `, { id: Number(id), userId: uid });
  return rs.recordset[0] ? { id: Number(id), deleted: true } : null;
}

module.exports = { savePlan, myPlans, detail, remove };
