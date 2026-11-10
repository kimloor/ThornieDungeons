// ---------- W6 Shared Presentation Event Bridge ----------
const PRESENTATION_EVENT_BRIDGE_CONTRACT = Object.freeze({
  version: 1,
  defaultSyncType: "PRESENTATION_SYNC",
  defaultStreamKey: "presentationId",
  targetSelectedType: "TARGET_SELECTED"
});

function createPresentationEventBridge({
  onEvent,
  onStatus,
  syncType = PRESENTATION_EVENT_BRIDGE_CONTRACT.defaultSyncType,
  streamKey = PRESENTATION_EVENT_BRIDGE_CONTRACT.defaultStreamKey,
  allowStaleSync = true
} = {}) {
  const resolvedSyncType = String(syncType || PRESENTATION_EVENT_BRIDGE_CONTRACT.defaultSyncType);
  const resolvedStreamKey = String(streamKey || PRESENTATION_EVENT_BRIDGE_CONTRACT.defaultStreamKey);
  let currentStreamId = null;
  let latestSeq = -1;

  const emit = (event, allowStale = false) => {
    if (!event) return false;
    const rawStreamId = event?.[resolvedStreamKey];
    const eventStreamId = rawStreamId == null || rawStreamId === "" ? null : String(rawStreamId);
    if (!allowStale && currentStreamId && eventStreamId && eventStreamId !== currentStreamId) return false;
    if (!allowStale && Number.isFinite(Number(event.seq)) && Number(event.seq) < latestSeq) return false;
    if (eventStreamId) currentStreamId = eventStreamId;
    if (Number.isFinite(Number(event.seq))) latestSeq = Math.max(latestSeq, Number(event.seq));
    onEvent?.(Object.freeze({
      ...event,
      [resolvedStreamKey]: currentStreamId,
      seq: latestSeq
    }));
    return true;
  };

  return Object.freeze({
    contract: PRESENTATION_EVENT_BRIDGE_CONTRACT,
    emit(event, options = {}) {
      return emit(event, !!options.allowStale);
    },
    sync(snapshot) {
      const event = {
        type: resolvedSyncType,
        [resolvedStreamKey]: snapshot?.[resolvedStreamKey],
        seq: snapshot?.seq,
        snapshot
      };
      return emit(event, !!allowStaleSync);
    },
    targetSelected(targetId) {
      return onEvent?.({
        type: PRESENTATION_EVENT_BRIDGE_CONTRACT.targetSelectedType,
        [resolvedStreamKey]: currentStreamId,
        targetId
      });
    },
    status(statusValue, detail) {
      onStatus?.(statusValue, detail);
    },
    reset() {
      currentStreamId = null;
      latestSeq = -1;
    },
    getState() {
      return Object.freeze({
        streamKey: resolvedStreamKey,
        streamId: currentStreamId,
        latestSeq
      });
    }
  });
}
