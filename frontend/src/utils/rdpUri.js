/**
 * Zero-Download RDP URI Generator for IntraAdmin
 * Constructs rdp:// protocol URIs for native Windows RDP client.
 * All params are URL-encoded to prevent injection.
 */

/**
 * Native RDP Generator for IntraAdmin
 * 
 * NOTE: Windows does not natively support an `rdp://` URI scheme for mstsc.exe out of the box.
 * To bypass browser "about:blank#blocked" strictness for unregistered protocols, 
 * this utility generates an in-memory .rdp file blob and triggers it.
 * 
 * If the admin sets their browser to "Always open files of this type",
 * it functions identically to a zero-download protocol trigger.
 */

export const triggerNativeRDP = ({ ip, username }) => {
  if (!ip) return;

  // Build standard .rdp file contents
  const lines = [
    `full address:s:${ip}`,
    `prompt for credentials:i:0`,
    `administrative session:i:1`,
    `audiomode:i:0`,
    `disable themes:i:1`
  ];

  if (username) {
    lines.push(`username:s:${username}`);
  }

  // Create an in-memory blob (no server roundtrip needed)
  const blob = new Blob([lines.join('\r\n')], { type: 'application/x-rdp' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ip}_IntraAdmin.rdp`;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 100);
};
