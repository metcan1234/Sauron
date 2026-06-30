const CHANNEL_PREFIXES = {
  "corporate-web": "Kurumsal web projesi — web brief ve şablona göre ilerle.\n",
  generic: "Workspace görevi — mevcut dosyaları ve hedefi dikkate al.\n",
  "electron-core": "Electron çekirdek geliştirme — minimal diff ve test odaklı ilerle.\n",
  "bridge-extension": "VS Code Bridge eklentisi — derleme ve test adımlarına uy.\n",
};

function getHandoffChannelPrefix(projectType) {
  const key = String(projectType || "generic").trim() || "generic";
  return CHANNEL_PREFIXES[key] || CHANNEL_PREFIXES.generic;
}

function prependChannelTemplate(taskSummary, projectType) {
  const prefix = getHandoffChannelPrefix(projectType);
  const body = String(taskSummary || "").trim();
  if (!prefix) {
    return body;
  }
  if (body.startsWith(prefix.trim())) {
    return body;
  }
  return body ? `${prefix}${body}` : prefix.trim();
}

module.exports = {
  CHANNEL_PREFIXES,
  getHandoffChannelPrefix,
  prependChannelTemplate,
};
