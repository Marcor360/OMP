import { isDeepStrictEqual } from 'node:util';
import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';
import { buildEventShifts, isEventDay, type EventSchedule } from './shared/event-planning.js';

type Reservation = { eventId: string; uid: string; start: string; end: string };

function byDay(eventId: string, schedules: EventSchedule[]) {
  const days = new Map<string, Reservation[]>();
  for (const schedule of schedules) {
    if (!isEventDay(schedule.date)) continue;
    const reservations = days.get(schedule.date) ?? [];
    for (const [index, shift] of buildEventShifts(schedule).entries()) {
      for (const uid of schedule.teams[index]?.memberIds ?? []) {
        reservations.push({ eventId, uid, ...shift });
      }
    }
    days.set(schedule.date, reservations);
  }
  return days;
}

export async function reserveEventShifts(
  transaction: Transaction, congregationId: string, eventId: string, previous: EventSchedule[], next: EventSchedule[]
): Promise<void> {
  const existing = byDay(eventId, previous);
  const incoming = byDay(eventId, next);
  if (isDeepStrictEqual(existing, incoming)) return;
  const days = [...new Set([...existing.keys(), ...incoming.keys()])].sort();
  if (!days.length) return;
  const collection = adminDb.collection('congregations').doc(congregationId).collection('eventShiftDays');
  const snapshots = await transaction.getAll(...days.map((day) => collection.doc(day)));
  for (const snapshot of snapshots) {
    const previousReservations = (snapshot.get('reservations') ?? []) as Reservation[];
    const newReservations = incoming.get(snapshot.id) ?? [];
    const remaining = previousReservations.filter((reservation) => reservation.eventId !== eventId);
    const byPerson = new Map<string, Reservation[]>();
    for (const item of remaining) {
      const list = byPerson.get(item.uid) ?? [];
      list.push(item);
      byPerson.set(item.uid, list);
    }
    for (const item of newReservations) {
      if (byPerson.get(item.uid)?.some((other) => other.start < item.end && item.start < other.end)) {
        throw new HttpsError('failed-precondition', `Una persona ya tiene otro turno el ${snapshot.id}, de ${item.start} a ${item.end}.`);
      }
    }
    if (!newReservations.length && remaining.length === previousReservations.length) continue;
    const reservations = [...remaining, ...newReservations];
    if (reservations.length > 3000) {
      throw new HttpsError('resource-exhausted', 'Se alcanzó el límite de turnos para ese día.');
    }
    if (reservations.length) transaction.set(snapshot.ref, { reservations });
    else transaction.delete(snapshot.ref);
  }
}
