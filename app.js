const stage = document.getElementById("stage");
const deviceLayer = document.getElementById("device-layer");
const wireLayer = document.getElementById("wire-layer");
const challengeSummary = document.getElementById("challenge-summary");
const statusBox = document.getElementById("status-box");
const connectionList = document.getElementById("connection-list");
const newSetupButton = document.getElementById("new-setup");
const resetWiringButton = document.getElementById("reset-wiring");

const MIXER_IMAGE_SIZE = {
  width: 1728,
  height: 616,
};

const DEVICE_SIZES = {
  mic: { width: 176, height: 132 },
  tablet: { width: 198, height: 124 },
  speaker: { width: 188, height: 132 },
  mixer: { width: 860, height: 307 },
};

const state = {
  challenge: null,
  devices: [],
  ports: new Map(),
  connections: [],
  selectedPortId: null,
  previewPoint: null,
  validation: null,
  stageSize: {
    width: 0,
    height: 0,
  },
};

const STAGE_MARGIN = 26;
const ROUTE_PADDING = 34;
const PORT_ESCAPE = 42;
const WIRE_LANE_GAP = 26;
const WIRE_NEAR_GAP = 18;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  const clone = [...array];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function jitter(value, amount) {
  return value + randomInt(-amount, amount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(first, second, gap = 28) {
  return !(
    first.x + first.width + gap <= second.x ||
    second.x + second.width + gap <= first.x ||
    first.y + first.height + gap <= second.y ||
    second.y + second.height + gap <= first.y
  );
}

function mixerPort(id, px, py, role, label, extra = {}) {
  return {
    id: `mixer-${id}`,
    role,
    label,
    x: Math.round((px / MIXER_IMAGE_SIZE.width) * DEVICE_SIZES.mixer.width),
    y: Math.round((py / MIXER_IMAGE_SIZE.height) * DEVICE_SIZES.mixer.height),
    ...extra,
  };
}

function buildMixerPorts() {
  return [
    mixerPort("mic-1-xlr", 142, 163, "in", "MIC 1 XLR", { jackType: "mic_xlr" }),
    mixerPort("mic-2-xlr", 359, 163, "in", "MIC 2 XLR", { jackType: "mic_xlr" }),
    mixerPort("mic-3-xlr", 575, 164, "in", "MIC 3 XLR", { jackType: "mic_xlr" }),
    mixerPort("mic-4-xlr", 790, 164, "in", "MIC 4 XLR", { jackType: "mic_xlr" }),
    mixerPort("line-1", 144, 338, "in", "CH 1 LINE IN", { jackType: "mono_line" }),
    mixerPort("line-2", 359, 338, "in", "CH 2 LINE IN", { jackType: "mono_line" }),
    mixerPort("line-3", 575, 338, "in", "CH 3 LINE IN", { jackType: "mono_line" }),
    mixerPort("line-4", 792, 339, "in", "CH 4 LINE IN", { jackType: "mono_line" }),
    mixerPort("fx-send", 932, 216, "out", "FX SEND", { jackType: "aux_out" }),
    mixerPort("phones", 1068, 216, "out", "PHONES", { jackType: "aux_out" }),
    mixerPort("monitor-l", 1206, 220, "out", "MONITOR OUT L", { jackType: "aux_out" }),
    mixerPort("monitor-r", 1330, 220, "out", "MONITOR OUT R", { jackType: "aux_out" }),
    mixerPort("stereo-5-6-l", 935, 327, "in", "LINE IN 5/6 L", {
      jackType: "stereo_line",
      pairId: "5/6",
    }),
    mixerPort("stereo-5-6-r", 936, 470, "in", "LINE IN 5/6 R", {
      jackType: "stereo_line",
      pairId: "5/6",
    }),
    mixerPort("stereo-7-8-l", 1069, 328, "in", "LINE IN 7/8 L", {
      jackType: "stereo_line",
      pairId: "7/8",
    }),
    mixerPort("stereo-7-8-r", 1070, 470, "in", "LINE IN 7/8 R", {
      jackType: "stereo_line",
      pairId: "7/8",
    }),
    mixerPort("stereo-9-10-l", 1206, 328, "in", "LINE IN 9/10 L", {
      jackType: "stereo_line",
      pairId: "9/10",
    }),
    mixerPort("stereo-9-10-r", 1207, 470, "in", "LINE IN 9/10 R", {
      jackType: "stereo_line",
      pairId: "9/10",
    }),
    mixerPort("stereo-11-12-l", 1332, 328, "in", "LINE IN 11/12 L", {
      jackType: "stereo_line",
      pairId: "11/12",
    }),
    mixerPort("stereo-11-12-r", 1333, 471, "in", "LINE IN 11/12 R", {
      jackType: "stereo_line",
      pairId: "11/12",
    }),
    mixerPort("main-l", 1478, 267, "out", "MAIN OUT L", { jackType: "main_out" }),
    mixerPort("main-r", 1603, 267, "out", "MAIN OUT R", { jackType: "main_out" }),
    mixerPort("rca-out-l", 1478, 350, "out", "STREAM USB/RCA OUT L", {
      jackType: "rca_out",
    }),
    mixerPort("rca-out-r", 1579, 350, "out", "STREAM USB/RCA OUT R", {
      jackType: "rca_out",
    }),
    mixerPort("rca-in-l", 1478, 461, "in", "STREAM USB/RCA IN L", {
      jackType: "rca_in",
    }),
    mixerPort("rca-in-r", 1579, 462, "in", "STREAM USB/RCA IN R", {
      jackType: "rca_in",
    }),
  ];
}

function createChallenge() {
  const previous = state.challenge;
  let micCount = randomInt(1, 4);
  let tabletCount = randomInt(0, 1);
  let speakerCount = randomInt(2, 5);

  if (previous) {
    while (
      micCount === previous.micCount &&
      tabletCount === previous.tabletCount &&
      speakerCount === previous.speakerCount
    ) {
      micCount = randomInt(1, 4);
      tabletCount = randomInt(0, 1);
      speakerCount = randomInt(2, 5);
    }
  }

  state.challenge = { micCount, tabletCount, speakerCount };
  state.connections = [];
  state.selectedPortId = null;
  state.previewPoint = null;
  buildDevices();
  validateAndRender();
}

function buildDevices() {
  const { micCount, tabletCount, speakerCount } = state.challenge;
  const stageWidth = 1700;
  const stageHeight = 980;

  state.stageSize = {
    width: stageWidth,
    height: stageHeight,
  };
  stage.style.width = `${stageWidth}px`;
  stage.style.height = `${stageHeight}px`;
  wireLayer.setAttribute("viewBox", `0 0 ${stageWidth} ${stageHeight}`);
  wireLayer.setAttribute("width", String(stageWidth));
  wireLayer.setAttribute("height", String(stageHeight));

  const devices = [];
  const portMap = new Map();
  const occupiedRects = [];

  function canPlace(rect) {
    return occupiedRects.every((placedRect) => !rectsOverlap(rect, placedRect, 34));
  }

  function takeSlot(size, centers) {
    for (const center of shuffle(centers)) {
      const rect = {
        x: clamp(jitter(center.x - size.width / 2, 18), 20, stageWidth - size.width - 20),
        y: clamp(jitter(center.y - size.height / 2, 18), 20, stageHeight - size.height - 20),
        width: size.width,
        height: size.height,
      };

      if (canPlace(rect)) {
        occupiedRects.push(rect);
        return { x: rect.x, y: rect.y };
      }
    }

    for (let y = 20; y <= stageHeight - size.height - 20; y += 18) {
      for (let x = 20; x <= stageWidth - size.width - 20; x += 18) {
        const rect = { x, y, width: size.width, height: size.height };
        if (canPlace(rect)) {
          occupiedRects.push(rect);
          return { x, y };
        }
      }
    }

    const fallbackRect = { x: 20, y: 20, width: size.width, height: size.height };
    occupiedRects.push(fallbackRect);
    return { x: 20, y: 20 };
  }

  const mixerPosition = takeSlot(DEVICE_SIZES.mixer, [
    { x: 860, y: 420 },
    { x: 860, y: 520 },
    { x: 780, y: 470 },
    { x: 940, y: 470 },
  ]);

  devices.push({
    id: "mixer-1",
    type: "mixer",
    label: "Mixer",
    ...mixerPosition,
    width: DEVICE_SIZES.mixer.width,
    height: DEVICE_SIZES.mixer.height,
    ports: buildMixerPorts(),
  });

  const peripheralCenters = [
    { x: 170, y: 120 },
    { x: 370, y: 120 },
    { x: 570, y: 120 },
    { x: 790, y: 105 },
    { x: 1030, y: 105 },
    { x: 1260, y: 118 },
    { x: 1480, y: 130 },
    { x: 110, y: 320 },
    { x: 1580, y: 320 },
    { x: 110, y: 520 },
    { x: 1580, y: 520 },
    { x: 180, y: 790 },
    { x: 380, y: 820 },
    { x: 610, y: 850 },
    { x: 860, y: 870 },
    { x: 1110, y: 850 },
    { x: 1350, y: 820 },
    { x: 1545, y: 790 },
  ];

  for (let index = 0; index < micCount; index += 1) {
    const id = `mic-${index + 1}`;
    const position = takeSlot(DEVICE_SIZES.mic, peripheralCenters);
    devices.push({
      id,
      type: "mic",
      label: `Microfono ${index + 1}`,
      ...position,
      width: DEVICE_SIZES.mic.width,
      height: DEVICE_SIZES.mic.height,
      ports: [
        {
          id: `${id}-out`,
          role: "out",
          x: DEVICE_SIZES.mic.width - 18,
          y: Math.round(DEVICE_SIZES.mic.height / 2),
          label: "OUT",
        },
      ],
    });
  }

  for (let index = 0; index < tabletCount; index += 1) {
    const id = `tablet-${index + 1}`;
    const position = takeSlot(DEVICE_SIZES.tablet, peripheralCenters);
    devices.push({
      id,
      type: "tablet",
      label: `Tablet ${index + 1}`,
      ...position,
      width: DEVICE_SIZES.tablet.width,
      height: DEVICE_SIZES.tablet.height,
      ports: [
        {
          id: `${id}-out`,
          role: "out",
          x: DEVICE_SIZES.tablet.width - 18,
          y: Math.round(DEVICE_SIZES.tablet.height / 2),
          label: "OUT",
        },
      ],
    });
  }

  for (let index = 0; index < speakerCount; index += 1) {
    const id = `speaker-${index + 1}`;
    const position = takeSlot(DEVICE_SIZES.speaker, peripheralCenters);
    devices.push({
      id,
      type: "speaker",
      label: `Speaker ${index + 1}`,
      ...position,
      width: DEVICE_SIZES.speaker.width,
      height: DEVICE_SIZES.speaker.height,
      ports: [
        { id: `${id}-in-1`, role: "in", x: 18, y: 54, label: "IN 1" },
        { id: `${id}-in-2`, role: "in", x: 18, y: 78, label: "IN 2" },
        { id: `${id}-out`, role: "out", x: DEVICE_SIZES.speaker.width - 18, y: 66, label: "OUT" },
      ],
    });
  }

  devices.forEach((device) => {
    device.ports.forEach((port) => {
      portMap.set(port.id, {
        ...port,
        deviceId: device.id,
        deviceType: device.type,
      });
    });
  });

  state.devices = devices;
  state.ports = portMap;
}

function portMeta(portId) {
  return state.ports.get(portId);
}

function getDevice(deviceId) {
  return state.devices.find((device) => device.id === deviceId);
}

function findConnectionByPort(portId) {
  return state.connections.find(
    (connection) => connection.first === portId || connection.second === portId
  );
}

function normalizeConnection(connection) {
  const firstPort = portMeta(connection.first);
  const secondPort = portMeta(connection.second);

  if (!firstPort || !secondPort) {
    return null;
  }

  if (firstPort.role === "out" && secondPort.role === "in") {
    return { fromPort: firstPort, toPort: secondPort };
  }

  if (firstPort.role === "in" && secondPort.role === "out") {
    return { fromPort: secondPort, toPort: firstPort };
  }

  return null;
}

function isValidConnectionPair(fromPort, toPort) {
  if (!fromPort || !toPort) {
    return false;
  }

  if (fromPort.role !== "out" || toPort.role !== "in") {
    return false;
  }

  if (
    fromPort.deviceType === "mic" &&
    toPort.deviceType === "mixer" &&
    toPort.jackType === "mic_xlr"
  ) {
    return true;
  }

  if (
    fromPort.deviceType === "tablet" &&
    toPort.deviceType === "mixer" &&
    toPort.jackType === "stereo_line"
  ) {
    return true;
  }

  if (
    fromPort.deviceType === "mixer" &&
    fromPort.jackType === "main_out" &&
    toPort.deviceType === "speaker"
  ) {
    return true;
  }

  if (fromPort.deviceType === "speaker" && toPort.deviceType === "speaker") {
    return true;
  }

  return false;
}

function describePort(portId) {
  const port = portMeta(portId);
  const device = getDevice(port.deviceId);
  return `${device.label} ${port.label}`;
}

function describeConnection(connection) {
  const normalized = normalizeConnection(connection);
  if (normalized && isValidConnectionPair(normalized.fromPort, normalized.toPort)) {
    return `${describePort(normalized.fromPort.id)} -> ${describePort(normalized.toPort.id)}`;
  }
  return `${describePort(connection.first)} -> ${describePort(connection.second)}`;
}

function removeConnectionByIndex(index) {
  state.connections.splice(index, 1);
  validateAndRender();
}

function handlePortClick(portId) {
  if (!portMeta(portId)) {
    return;
  }

  if (!state.selectedPortId) {
    state.selectedPortId = portId;
    state.previewPoint = portCenter(portId);
    renderDevices();
    drawConnections();
    return;
  }

  if (state.selectedPortId === portId) {
    state.selectedPortId = null;
    state.previewPoint = null;
    renderDevices();
    drawConnections();
    return;
  }

  state.connections = state.connections.filter(
    (connection) =>
      connection.first !== state.selectedPortId &&
      connection.second !== state.selectedPortId &&
      connection.first !== portId &&
      connection.second !== portId
  );

  state.connections.push({
    first: state.selectedPortId,
    second: portId,
  });

  state.selectedPortId = null;
  state.previewPoint = null;
  validateAndRender();
}

function classifyConnection(connection, solved) {
  if (solved) {
    return "success";
  }

  const normalized = normalizeConnection(connection);
  return normalized && isValidConnectionPair(normalized.fromPort, normalized.toPort)
    ? "neutral"
    : "error";
}

function validateConnections() {
  const { micCount, tabletCount, speakerCount } = state.challenge;
  const errors = [];
  const micDevices = state.devices.filter((device) => device.type === "mic");
  const tabletDevices = state.devices.filter((device) => device.type === "tablet");
  const speakerDevices = state.devices.filter((device) => device.type === "speaker");
  const portUsage = new Map();
  let hasInvalidPair = false;

  for (const connection of state.connections) {
    portUsage.set(connection.first, (portUsage.get(connection.first) || 0) + 1);
    portUsage.set(connection.second, (portUsage.get(connection.second) || 0) + 1);

    const normalized = normalizeConnection(connection);
    if (!normalized || !isValidConnectionPair(normalized.fromPort, normalized.toPort)) {
      hasInvalidPair = true;
    }
  }

  for (const [, count] of portUsage) {
    if (count > 1) {
      errors.push("Ogni connettore puo ospitare un solo cavo.");
      break;
    }
  }

  if (hasInvalidPair) {
    errors.push(
      "Controlla il tipo di collegamento: i microfoni entrano negli XLR del mixer, i tablet nelle coppie stereo, gli speaker partono dai MAIN OUT e poi proseguono in catena."
    );
  }

  const usedMicInputs = new Set();
  for (const mic of micDevices) {
    const connection = findConnectionByPort(`${mic.id}-out`);
    if (!connection) {
      errors.push(`Manca il collegamento in uscita per ${mic.label}.`);
      continue;
    }

    const normalized = normalizeConnection(connection);
    if (
      !normalized ||
      normalized.fromPort.id !== `${mic.id}-out` ||
      normalized.toPort.jackType !== "mic_xlr"
    ) {
      errors.push(`${mic.label} deve andare solo su un ingresso XLR del mixer.`);
      continue;
    }

    usedMicInputs.add(normalized.toPort.id);
  }

  if (usedMicInputs.size !== micCount) {
    errors.push("Ogni microfono deve usare un XLR diverso del mixer.");
  }

  const usedStereoPairs = new Set();
  for (const tablet of tabletDevices) {
    const connection = findConnectionByPort(`${tablet.id}-out`);
    if (!connection) {
      errors.push(`Manca il collegamento in uscita per ${tablet.label}.`);
      continue;
    }

    const normalized = normalizeConnection(connection);
    if (
      !normalized ||
      normalized.fromPort.id !== `${tablet.id}-out` ||
      normalized.toPort.jackType !== "stereo_line"
    ) {
      errors.push(`${tablet.label} deve entrare solo su una coppia stereo del mixer.`);
      continue;
    }

    usedStereoPairs.add(normalized.toPort.pairId);
  }

  if (usedStereoPairs.size !== tabletCount) {
    errors.push("Ogni tablet deve occupare una coppia stereo diversa del mixer.");
  }

  const speakerIncoming = new Map();
  const speakerOutgoing = new Map();
  const mixerRoots = new Set();

  for (const connection of state.connections) {
    const normalized = normalizeConnection(connection);
    if (!normalized || !isValidConnectionPair(normalized.fromPort, normalized.toPort)) {
      continue;
    }

    if (normalized.toPort.deviceType === "speaker") {
      speakerIncoming.set(normalized.toPort.deviceId, connection);

      if (normalized.fromPort.deviceType === "speaker") {
        speakerOutgoing.set(normalized.fromPort.deviceId, normalized.toPort.deviceId);
      }

      if (normalized.fromPort.deviceType === "mixer") {
        mixerRoots.add(normalized.fromPort.id);
      }
    }
  }

  for (const speaker of speakerDevices) {
    if (!speakerIncoming.has(speaker.id)) {
      errors.push(`${speaker.label} non riceve nessun segnale.`);
    }
  }

  if (mixerRoots.size > 2) {
    errors.push("Il mixer ha solo 2 MAIN OUT: dal terzo speaker in poi prosegui collegando uno speaker al successivo.");
  }

  const rootSpeakers = speakerDevices
    .filter((speaker) => {
      const incoming = speakerIncoming.get(speaker.id);
      return incoming && normalizeConnection(incoming)?.fromPort.deviceType === "mixer";
    })
    .map((speaker) => speaker.id);

  if (rootSpeakers.length === 0) {
    errors.push("Fai partire almeno uno speaker da MAIN OUT L o MAIN OUT R del mixer.");
  }

  const visited = new Set();
  let hasCycle = false;

  for (const rootId of rootSpeakers) {
    let current = rootId;
    const chainSeen = new Set();

    while (current) {
      if (chainSeen.has(current)) {
        hasCycle = true;
        break;
      }
      chainSeen.add(current);
      visited.add(current);
      current = speakerOutgoing.get(current);
    }
  }

  if (hasCycle) {
    errors.push("La catena degli speaker non puo chiudersi su se stessa.");
  }

  if (visited.size !== speakerCount) {
    errors.push("Ogni speaker deve appartenere a una catena che parte da MAIN OUT del mixer.");
  }

  const expectedConnections = micCount + tabletCount + speakerCount;
  if (state.connections.length !== expectedConnections) {
    errors.push(
      `In questo scenario servono ${expectedConnections} cavi: ${micCount} microfoni, ${tabletCount} tablet e ${speakerCount} speaker.`
    );
  }

  return {
    solved: errors.length === 0,
    errors,
  };
}

function buildStatusMarkup(validation) {
  if (validation.solved) {
    return {
      state: "success",
      title: "Configurazione completata",
      text:
        "Tutti i collegamenti sono corretti: microfoni sugli XLR, tablet sulle coppie stereo e speaker collegati da MAIN OUT o in cascata.",
      showNext: true,
    };
  }

  if (state.connections.length === 0) {
    return {
      state: "idle",
      title: "Inizia a collegare",
      text:
        "Seleziona una porta di uscita e poi l'ingresso corretto. Per completare lo scenario usa gli XLR per i microfoni, le coppie stereo per i tablet e i MAIN OUT del mixer per i primi speaker.",
      showNext: false,
    };
  }

  return {
    state: "error",
    title: "Controlla i collegamenti",
    text: validation.errors[0],
    showNext: false,
  };
}

function renderSummary() {
  const { micCount, tabletCount, speakerCount } = state.challenge;
  challengeSummary.innerHTML = `
    <div class="summary-chip">
      <span>Microfoni</span>
      <strong>${micCount}</strong>
    </div>
    <div class="summary-chip">
      <span>Tablet</span>
      <strong>${tabletCount}</strong>
    </div>
    <div class="summary-chip">
      <span>Mixer</span>
      <strong>XENYX 1202SFX</strong>
    </div>
    <div class="summary-chip">
      <span>Speaker</span>
      <strong>${speakerCount}</strong>
    </div>
  `;
}

function renderStatus() {
  const info = buildStatusMarkup(state.validation);
  statusBox.dataset.state = info.state;
  statusBox.innerHTML = `
    <div class="status-title">${info.title}</div>
    <div class="status-text">${info.text}</div>
    ${
      info.showNext
        ? `<div class="success-cta"><button class="button button-primary" id="next-from-status">Nuovo scenario</button></div>`
        : ""
    }
  `;

  const nextFromStatus = document.getElementById("next-from-status");
  if (nextFromStatus) {
    nextFromStatus.addEventListener("click", createChallenge);
  }
}

function renderConnectionList() {
  if (state.connections.length === 0) {
    connectionList.innerHTML = '<div class="empty-state">Aggiungi il primo collegamento.</div>';
    return;
  }

  connectionList.innerHTML = state.connections
    .map(
      (connection, index) => `
        <div class="connection-item">
          <span>${describeConnection(connection)}</span>
          <button class="chip-remove" data-remove-index="${index}">Rimuovi</button>
        </div>
      `
    )
    .join("");

  connectionList.querySelectorAll("[data-remove-index]").forEach((button) => {
    button.addEventListener("click", () => {
      removeConnectionByIndex(Number(button.dataset.removeIndex));
    });
  });
}

function renderDevices() {
  deviceLayer.innerHTML = "";

  state.devices.forEach((device) => {
    const element = document.createElement("article");
    element.className = `device device-${device.type}`;
    element.style.left = `${device.x}px`;
    element.style.top = `${device.y}px`;
    element.style.width = `${device.width}px`;
    element.style.height = `${device.height}px`;

    let innerMarkup = "";

    if (device.type === "mixer") {
      innerMarkup = `<div class="device-visual device-visual-mixer"></div>`;
    } else if (device.type === "mic") {
      innerMarkup = `
        <div class="device-header"><div class="device-title">${device.label}</div></div>
        <div class="device-visual"><span></span></div>
      `;
    } else if (device.type === "tablet") {
      innerMarkup = `
        <div class="device-header"><div class="device-title">${device.label}</div></div>
        <div class="device-visual"><span></span></div>
      `;
    } else {
      innerMarkup = `
        <div class="device-header"><div class="device-title">${device.label}</div></div>
        <div class="device-visual"></div>
      `;
    }

    element.innerHTML = innerMarkup;

    device.ports.forEach((port) => {
      const portButton = document.createElement("button");
      portButton.className = `port ${device.type === "mixer" ? "port-mixer" : ""}`;
      if (state.selectedPortId === port.id) {
        portButton.classList.add("selected");
      }

      portButton.dataset.portId = port.id;
      portButton.dataset.role = port.role;
      portButton.style.left = `${port.x - (device.type === "mixer" ? 7 : 9)}px`;
      portButton.style.top = `${port.y - (device.type === "mixer" ? 7 : 9)}px`;
      portButton.title = `${device.label} ${port.label}`;
      portButton.setAttribute("aria-label", `${device.label} ${port.label}`);
      portButton.addEventListener("click", (event) => {
        event.stopPropagation();
        handlePortClick(port.id);
      });
      element.appendChild(portButton);

      if (device.type !== "mixer") {
        const label = document.createElement("span");
        label.className = `port-label ${port.role === "in" ? "port-label-left" : "port-label-right"}`;
        label.textContent = port.label;
        label.style.top = `${port.y}px`;
        element.appendChild(label);
      }
    });

    deviceLayer.appendChild(element);
  });
}

function portCenter(portId) {
  const button = deviceLayer.querySelector(`[data-port-id="${portId}"]`);
  if (!button) {
    return null;
  }

  const stageRect = stage.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  return {
    x: buttonRect.left - stageRect.left + buttonRect.width / 2,
    y: buttonRect.top - stageRect.top + buttonRect.height / 2,
  };
}

function clampToStage(value, axis) {
  const limit = axis === "x" ? state.stageSize.width : state.stageSize.height;
  return clamp(Math.round(value), STAGE_MARGIN, limit - STAGE_MARGIN);
}

function getDeviceRect(device, padding = 0) {
  return {
    left: device.x - padding,
    right: device.x + device.width + padding,
    top: device.y - padding,
    bottom: device.y + device.height + padding,
  };
}

function buildRect(left, top, right, bottom) {
  return {
    left: clamp(Math.round(Math.min(left, right)), 0, state.stageSize.width),
    right: clamp(Math.round(Math.max(left, right)), 0, state.stageSize.width),
    top: clamp(Math.round(Math.min(top, bottom)), 0, state.stageSize.height),
    bottom: clamp(Math.round(Math.max(top, bottom)), 0, state.stageSize.height),
  };
}

function getRoutingObstacles(excludedDeviceIds = new Set(), padding = ROUTE_PADDING) {
  return state.devices
    .filter((device) => !excludedDeviceIds.has(device.id))
    .map((device) => getDeviceRect(device, padding));
}

function getDeviceObstacles(padding = 0) {
  return state.devices.map((device) => getDeviceRect(device, padding));
}

function getProtectedObstacles(excludedPortIds = new Set()) {
  const obstacles = [];

  state.devices.forEach((device) => {
    if (device.type !== "mixer") {
      obstacles.push(
        buildRect(device.x + 16, device.y + 10, device.x + device.width - 16, device.y + 58)
      );
    }

    device.ports.forEach((port) => {
      const absoluteX = device.x + port.x;
      const absoluteY = device.y + port.y;

      if (!excludedPortIds.has(port.id)) {
        obstacles.push(buildRect(absoluteX - 19, absoluteY - 19, absoluteX + 19, absoluteY + 19));
      }

      if (device.type === "mixer") {
        return;
      }

      if (port.role === "in") {
        obstacles.push(buildRect(device.x + 8, absoluteY - 18, device.x + 74, absoluteY + 18));
        return;
      }

      obstacles.push(
        buildRect(device.x + device.width - 74, absoluteY - 18, device.x + device.width - 8, absoluteY + 18)
      );
    });
  });

  return obstacles;
}

function simplifyPolyline(points) {
  const compact = [];

  points.forEach((point) => {
    if (!point) {
      return;
    }

    const normalizedPoint = {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };

    const previous = compact[compact.length - 1];
    if (previous && previous.x === normalizedPoint.x && previous.y === normalizedPoint.y) {
      return;
    }

    compact.push(normalizedPoint);
  });

  let changed = true;
  while (changed) {
    changed = false;

    for (let index = 1; index < compact.length - 1; index += 1) {
      const previous = compact[index - 1];
      const current = compact[index];
      const next = compact[index + 1];

      if (
        (previous.x === current.x && current.x === next.x) ||
        (previous.y === current.y && current.y === next.y)
      ) {
        compact.splice(index, 1);
        changed = true;
        break;
      }
    }
  }

  return compact;
}

function polylineToPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function polylineSegments(points) {
  const segments = [];

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];

    if (from.x === to.x && from.y === to.y) {
      continue;
    }

    segments.push({
      from,
      to,
      axis: from.y === to.y ? "x" : "y",
    });
  }

  return segments;
}

function segmentBounds(segment) {
  return {
    minX: Math.min(segment.from.x, segment.to.x),
    maxX: Math.max(segment.from.x, segment.to.x),
    minY: Math.min(segment.from.y, segment.to.y),
    maxY: Math.max(segment.from.y, segment.to.y),
  };
}

function overlapLength(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = intervals
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)])
    .sort((first, second) => first[0] - second[0]);
  const merged = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const [start, end] = sorted[index];
    const previous = merged[merged.length - 1];

    if (start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
      continue;
    }

    merged.push([start, end]);
  }

  return merged;
}

function segmentOverlapIntervals(segment, obstacles) {
  const intervals = [];
  const minX = Math.min(segment.from.x, segment.to.x);
  const maxX = Math.max(segment.from.x, segment.to.x);
  const minY = Math.min(segment.from.y, segment.to.y);
  const maxY = Math.max(segment.from.y, segment.to.y);

  obstacles.forEach((obstacle) => {
    if (segment.axis === "x") {
      if (segment.from.y < obstacle.top || segment.from.y > obstacle.bottom) {
        return;
      }

      const start = Math.max(minX, obstacle.left);
      const end = Math.min(maxX, obstacle.right);
      if (end > start) {
        intervals.push([start, end]);
      }
      return;
    }

    if (segment.from.x < obstacle.left || segment.from.x > obstacle.right) {
      return;
    }

    const start = Math.max(minY, obstacle.top);
    const end = Math.min(maxY, obstacle.bottom);
    if (end > start) {
      intervals.push([start, end]);
    }
  });

  return mergeIntervals(intervals);
}

function buildVisibleSegmentsPath(points, obstacles) {
  const commands = [];

  polylineSegments(points).forEach((segment) => {
    const overlaps = segmentOverlapIntervals(segment, obstacles);
    const start = segment.axis === "x" ? segment.from.x : segment.from.y;
    const end = segment.axis === "x" ? segment.to.x : segment.to.y;
    const ascending = start <= end;
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);
    const visibleRanges = [];
    let cursor = normalizedStart;

    overlaps.forEach(([overlapStart, overlapEnd]) => {
      if (overlapStart > cursor) {
        visibleRanges.push([cursor, overlapStart]);
      }
      cursor = Math.max(cursor, overlapEnd);
    });

    if (cursor < normalizedEnd) {
      visibleRanges.push([cursor, normalizedEnd]);
    }

    const orderedRanges = ascending ? visibleRanges : [...visibleRanges].reverse();
    orderedRanges.forEach(([rangeStart, rangeEnd]) => {
      const fromValue = ascending ? rangeStart : rangeEnd;
      const toValue = ascending ? rangeEnd : rangeStart;

      if (Math.abs(toValue - fromValue) < 1) {
        return;
      }

      if (segment.axis === "x") {
        commands.push(`M ${fromValue} ${segment.from.y} L ${toValue} ${segment.from.y}`);
        return;
      }

      commands.push(`M ${segment.from.x} ${fromValue} L ${segment.from.x} ${toValue}`);
    });
  });

  return commands.join(" ");
}

function wireCollisionMetrics(points, occupiedSegments) {
  let overlap = 0;
  let near = 0;
  let crossings = 0;
  const candidateSegments = polylineSegments(points);

  candidateSegments.forEach((segment) => {
    const segmentBox = segmentBounds(segment);

    occupiedSegments.forEach((occupied) => {
      const occupiedBox = segmentBounds(occupied);

      if (segment.axis === occupied.axis) {
        if (segment.axis === "x") {
          const sharedLength = overlapLength(
            segmentBox.minX,
            segmentBox.maxX,
            occupiedBox.minX,
            occupiedBox.maxX
          );
          if (sharedLength === 0) {
            return;
          }

          const distance = Math.abs(segment.from.y - occupied.from.y);
          if (distance === 0) {
            overlap += sharedLength;
            return;
          }

          if (distance < WIRE_NEAR_GAP) {
            near += sharedLength * (WIRE_NEAR_GAP - distance);
          }
          return;
        }

        const sharedLength = overlapLength(
          segmentBox.minY,
          segmentBox.maxY,
          occupiedBox.minY,
          occupiedBox.maxY
        );
        if (sharedLength === 0) {
          return;
        }

        const distance = Math.abs(segment.from.x - occupied.from.x);
        if (distance === 0) {
          overlap += sharedLength;
          return;
        }

        if (distance < WIRE_NEAR_GAP) {
          near += sharedLength * (WIRE_NEAR_GAP - distance);
        }
        return;
      }

      const horizontal = segment.axis === "x" ? segment : occupied;
      const vertical = segment.axis === "y" ? segment : occupied;
      const horizontalBox = horizontal === segment ? segmentBox : occupiedBox;
      const verticalBox = vertical === segment ? segmentBox : occupiedBox;

      if (
        vertical.from.x > horizontalBox.minX &&
        vertical.from.x < horizontalBox.maxX &&
        horizontal.from.y > verticalBox.minY &&
        horizontal.from.y < verticalBox.maxY
      ) {
        crossings += 1;
      }
    });
  });

  return {
    overlap,
    near,
    crossings,
  };
}

function routeMetrics(points, obstacles, occupiedSegments) {
  let length = 0;
  let overlap = 0;

  polylineSegments(points).forEach((segment) => {
    length += Math.abs(segment.to.x - segment.from.x) + Math.abs(segment.to.y - segment.from.y);
    segmentOverlapIntervals(segment, obstacles).forEach(([start, end]) => {
      overlap += end - start;
    });
  });

  const wireMetrics = wireCollisionMetrics(points, occupiedSegments);

  return {
    length,
    overlap,
    turns: Math.max(0, polylineSegments(points).length - 1),
    wireOverlap: wireMetrics.overlap,
    wireNear: wireMetrics.near,
    crossings: wireMetrics.crossings,
  };
}

function resolvePortEscape(port, point) {
  if (!port) {
    return point;
  }

  const device = getDevice(port.deviceId);
  if (!device) {
    return point;
  }

  const absoluteX = device.x + port.x;
  const escapeDirection =
    absoluteX < device.x + device.width / 2 ? -1 : absoluteX > device.x + device.width / 2 ? 1 : port.role === "in" ? -1 : 1;

  return {
    x: clampToStage(point.x + escapeDirection * PORT_ESCAPE, "x"),
    y: Math.round(point.y),
  };
}

function collectCorridors(axis, startPoint, endPoint, obstacles, occupiedSegments) {
  const values = [
    axis === "x" ? STAGE_MARGIN : STAGE_MARGIN,
    axis === "x" ? state.stageSize.width - STAGE_MARGIN : state.stageSize.height - STAGE_MARGIN,
    axis === "x" ? startPoint.x : startPoint.y,
    axis === "x" ? endPoint.x : endPoint.y,
    axis === "x"
      ? (startPoint.x + endPoint.x) / 2
      : (startPoint.y + endPoint.y) / 2,
  ];

  obstacles.forEach((obstacle) => {
    if (axis === "x") {
      values.push(obstacle.left - ROUTE_PADDING, obstacle.right + ROUTE_PADDING);
      return;
    }

    values.push(obstacle.top - ROUTE_PADDING, obstacle.bottom + ROUTE_PADDING);
  });

  occupiedSegments.forEach((segment) => {
    if (axis === "x" && segment.axis === "y") {
      values.push(
        segment.from.x - WIRE_LANE_GAP * 2,
        segment.from.x - WIRE_LANE_GAP,
        segment.from.x + WIRE_LANE_GAP,
        segment.from.x + WIRE_LANE_GAP * 2
      );
      values.push(segment.from.x);
      return;
    }

    if (axis === "y" && segment.axis === "x") {
      values.push(
        segment.from.y - WIRE_LANE_GAP * 2,
        segment.from.y - WIRE_LANE_GAP,
        segment.from.y + WIRE_LANE_GAP,
        segment.from.y + WIRE_LANE_GAP * 2
      );
      values.push(segment.from.y);
    }
  });

  return [...new Set(values.map((value) => clampToStage(value, axis)))];
}

function buildOrthogonalRoute(from, to, fromPort, toPort, occupiedSegments = []) {
  const excludedDeviceIds = new Set();
  const excludedPortIds = new Set();
  if (fromPort) {
    excludedDeviceIds.add(fromPort.deviceId);
    excludedPortIds.add(fromPort.id);
  }
  if (toPort) {
    excludedDeviceIds.add(toPort.deviceId);
    excludedPortIds.add(toPort.id);
  }

  const obstacles = [
    ...getRoutingObstacles(excludedDeviceIds),
    ...getProtectedObstacles(excludedPortIds),
  ];
  const startLead = resolvePortEscape(fromPort, from);
  const endLead = resolvePortEscape(toPort, to);
  const candidates = [];
  const xCorridors = collectCorridors("x", startLead, endLead, obstacles, occupiedSegments);
  const yCorridors = collectCorridors("y", startLead, endLead, obstacles, occupiedSegments);

  const pushCandidate = (points) => {
    const simplified = simplifyPolyline(points);
    if (simplified.length >= 2) {
      candidates.push(simplified);
    }
  };

  if (toPort) {
    pushCandidate([from, startLead, { x: endLead.x, y: startLead.y }, endLead, to]);
    pushCandidate([from, startLead, { x: startLead.x, y: endLead.y }, endLead, to]);
  } else {
    pushCandidate([from, startLead, { x: to.x, y: startLead.y }, to]);
    pushCandidate([from, startLead, { x: startLead.x, y: to.y }, to]);
  }

  xCorridors.forEach((corridorX) => {
    pushCandidate([
      from,
      startLead,
      { x: corridorX, y: startLead.y },
      { x: corridorX, y: endLead.y },
      endLead,
      to,
    ]);
  });

  yCorridors.forEach((corridorY) => {
    pushCandidate([
      from,
      startLead,
      { x: startLead.x, y: corridorY },
      { x: endLead.x, y: corridorY },
      endLead,
      to,
    ]);
  });

  xCorridors.forEach((corridorX) => {
    yCorridors.forEach((corridorY) => {
      pushCandidate([
        from,
        startLead,
        { x: startLead.x, y: corridorY },
        { x: corridorX, y: corridorY },
        { x: corridorX, y: endLead.y },
        endLead,
        to,
      ]);

      pushCandidate([
        from,
        startLead,
        { x: corridorX, y: startLead.y },
        { x: corridorX, y: corridorY },
        { x: endLead.x, y: corridorY },
        endLead,
        to,
      ]);
    });
  });

  let bestPoints = candidates[0] || simplifyPolyline([from, to]);
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const metrics = routeMetrics(candidate, obstacles, occupiedSegments);
    const score =
      metrics.overlap * 1300 +
      metrics.wireOverlap * 2400 +
      metrics.wireNear * 8 +
      metrics.crossings * 160 +
      metrics.turns * 42 +
      metrics.length;

    if (score < bestScore) {
      bestScore = score;
      bestPoints = candidate;
    }
  });

  return {
    points: bestPoints,
    hiddenObstacles: getProtectedObstacles(),
    overlapObstacles: [...getDeviceObstacles(0), ...getProtectedObstacles()],
  };
}

function connectionGeometry(connection) {
  const normalized = normalizeConnection(connection);

  if (normalized && isValidConnectionPair(normalized.fromPort, normalized.toPort)) {
    const from = portCenter(normalized.fromPort.id);
    const to = portCenter(normalized.toPort.id);
    return {
      from,
      to,
      valid: true,
      route: from && to ? buildOrthogonalRoute(from, to, normalized.fromPort, normalized.toPort) : null,
    };
  }

  const firstPort = portMeta(connection.first);
  const secondPort = portMeta(connection.second);
  const from = portCenter(connection.first);
  const to = portCenter(connection.second);

  return {
    from,
    to,
    valid: false,
    route: from && to ? buildOrthogonalRoute(from, to, firstPort, secondPort) : null,
  };
}

function collectRouteEntries() {
  const occupiedSegments = [];
  const routeEntries = [];

  state.connections.forEach((connection) => {
    const normalized = normalizeConnection(connection);
    const valid = Boolean(normalized && isValidConnectionPair(normalized.fromPort, normalized.toPort));
    const fromPort = valid ? normalized.fromPort : portMeta(connection.first);
    const toPort = valid ? normalized.toPort : portMeta(connection.second);
    const from = portCenter(valid ? normalized.fromPort.id : connection.first);
    const to = portCenter(valid ? normalized.toPort.id : connection.second);
    const route = from && to ? buildOrthogonalRoute(from, to, fromPort, toPort, occupiedSegments) : null;

    routeEntries.push({
      connection,
      from,
      to,
      valid,
      route,
    });

    if (route) {
      occupiedSegments.push(...polylineSegments(route.points));
    }
  });

  return {
    routeEntries,
    occupiedSegments,
  };
}

function drawConnections() {
  wireLayer.innerHTML = "";

  const { routeEntries, occupiedSegments } = collectRouteEntries();

  routeEntries.forEach(({ connection, from, to, valid, route }, index) => {
    if (!from || !to || !route) {
      return;
    }

    const d = polylineToPath(route.points);
    const dimmedPath = buildVisibleSegmentsPath(route.points, route.hiddenObstacles);
    const visiblePath = buildVisibleSegmentsPath(route.points, route.overlapObstacles);
    const wireClass = `wire wire-${classifyConnection(connection, state.validation.solved)}`;

    if (dimmedPath) {
      const overlapBasePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      overlapBasePath.setAttribute("d", dimmedPath);
      overlapBasePath.setAttribute("class", `${wireClass} wire-overlap-base`);
      wireLayer.appendChild(overlapBasePath);
    }

    if (visiblePath) {
      const visibleWirePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      visibleWirePath.setAttribute("d", visiblePath);
      visibleWirePath.setAttribute("class", wireClass);
      wireLayer.appendChild(visibleWirePath);
    }

    if (valid) {
      const flowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      flowPath.setAttribute(
        "class",
        `wire-flow ${state.validation.solved ? "wire-flow-success" : "wire-flow-neutral"}`
      );
      flowPath.setAttribute("d", dimmedPath || visiblePath || d);
      wireLayer.appendChild(flowPath);
    }

    const hitboxPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitboxPath.setAttribute("d", d);
    hitboxPath.setAttribute("class", "wire-hitbox");
    hitboxPath.dataset.connectionIndex = String(index);
    hitboxPath.addEventListener("click", (event) => {
      event.stopPropagation();
      removeConnectionByIndex(Number(hitboxPath.dataset.connectionIndex));
    });
    wireLayer.appendChild(hitboxPath);
  });

  if (state.selectedPortId && state.previewPoint) {
    const start = portCenter(state.selectedPortId);
    if (start) {
      const previewRoute = buildOrthogonalRoute(
        start,
        state.previewPoint,
        portMeta(state.selectedPortId),
        null,
        occupiedSegments
      );
      const previewPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      previewPath.setAttribute("d", polylineToPath(previewRoute.points));
      previewPath.setAttribute("class", "wire wire-preview");
      wireLayer.appendChild(previewPath);
    }
  }
}

function validateAndRender() {
  state.validation = validateConnections();
  renderSummary();
  renderStatus();
  renderConnectionList();
  renderDevices();
  requestAnimationFrame(drawConnections);
}

function updatePreviewPoint(event) {
  if (!state.selectedPortId) {
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  state.previewPoint = {
    x: event.clientX - stageRect.left,
    y: event.clientY - stageRect.top,
  };
  drawConnections();
}

newSetupButton.addEventListener("click", createChallenge);
resetWiringButton.addEventListener("click", () => {
  state.connections = [];
  state.selectedPortId = null;
  state.previewPoint = null;
  validateAndRender();
});

stage.addEventListener("mousemove", updatePreviewPoint);
stage.addEventListener("mouseleave", () => {
  if (!state.selectedPortId) {
    return;
  }
  state.previewPoint = portCenter(state.selectedPortId);
  drawConnections();
});

stage.addEventListener("click", (event) => {
  if (event.target !== stage) {
    return;
  }
  state.selectedPortId = null;
  state.previewPoint = null;
  renderDevices();
  drawConnections();
});

window.addEventListener("resize", () => {
  requestAnimationFrame(drawConnections);
});

createChallenge();
