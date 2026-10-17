import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * The agent certificate as a simplified, industry-standard PDF.
 *
 * Layout follows the clean IBM/Microsoft/Cisco convention:
 * - header: the real Colly logo, the wordmark and the programme name
 * - body: "This certifies that" + the holder's name + the award line
 * - footer: a bold CERTIFIED line, the QR verification block, the issued
 *   date / IDs, and the signature block
 * - a single thin orange border frames the page
 *
 * @react-pdf/renderer constraints handled here:
 * - Inter is loaded for the web via next/font but is NOT registered with
 *   react-pdf (no font files ship in the repo), so text falls back to the
 *   built-in Helvetica/Helvetica-Bold.
 * - The logo is passed in as `logoSrc` (a PNG data URI). react-pdf's `<Image>`
 *   cannot rasterise SVG, so the caller supplies the PNG produced by
 *   `scripts/convert-logo.cjs`; the logo is omitted if it is unavailable.
 */

export type AgentCertificatePdfProps = {
  fullName: string;
  agentNumber: string;
  certificateId: string;
  issuedAt: string;
  verifyUrl: string;
  qrDataUrl: string;
  /** PNG data URI for the Colly logo. Optional so the PDF still builds without it. */
  logoSrc?: string;
};

const ORANGE = "#FF6600";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    // The 5mm page padding insets the border 5mm from the paper edge.
    padding: "5mm",
  },
  frame: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: ORANGE,
    padding: "14mm",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Header
  logo: { width: 64, height: 64 },
  wordmark: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    letterSpacing: 2,
    marginTop: 8,
  },
  programme: {
    fontSize: 9,
    color: MUTED,
    letterSpacing: 2,
    marginTop: 4,
  },

  // Body
  middle: { alignItems: "center" },
  certifies: { fontSize: 12, color: MUTED },
  name: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: INK,
    textAlign: "center",
    marginTop: 12,
  },
  body: {
    fontSize: 12,
    color: BODY,
    textAlign: "center",
    lineHeight: 1.5,
    marginTop: 16,
    maxWidth: 340,
  },

  // Footer
  footer: { alignItems: "center", width: "100%" },
  certified: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    letterSpacing: 4,
    textAlign: "center",
  },
  qrBlock: { alignItems: "center", marginTop: 16 },
  qr: { width: "30mm", height: "30mm" },
  qrCaption: { fontSize: 8, color: MUTED, marginTop: 6 },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 20,
  },
  metaText: { fontSize: 9, color: MUTED },

  signature: { alignItems: "center", marginTop: 18 },
  signatureLine: {
    width: "60mm",
    height: 1,
    backgroundColor: INK,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  signatureRole: { fontSize: 9, color: MUTED, marginTop: 2 },
});

export function AgentCertificatePdf({
  fullName,
  agentNumber,
  certificateId,
  issuedAt,
  verifyUrl,
  qrDataUrl,
  logoSrc,
}: AgentCertificatePdfProps) {
  // QR keeps the full URL; the caption drops the scheme for readability.
  const captionUrl = verifyUrl.replace(/^https?:\/\//, "");

  return (
    <Document
      title={`Colly Agent Certificate - ${fullName}`}
      author="Colly"
      subject="Colly Agent Certification"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          {/* Header: real logo + wordmark */}
          <View style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
            <Text style={styles.wordmark}>COLLY</Text>
            <Text style={styles.programme}>AGENT CERTIFICATION PROGRAMME</Text>
          </View>

          {/* Body: award copy */}
          <View style={styles.middle}>
            <Text style={styles.certifies}>This certifies that</Text>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.body}>
              has successfully completed all four course requirements and passed
              the Final Certification Exam
            </Text>
          </View>

          {/* Footer: CERTIFIED, QR, meta and signature */}
          <View style={styles.footer}>
            <Text style={styles.certified}>CERTIFIED</Text>

            <View style={styles.qrBlock}>
              {/* react-pdf's Image has no `alt` prop; the QR is decorative here
                  because the verification URL is printed directly beneath it. */}
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.qr} src={qrDataUrl} />
              <Text style={styles.qrCaption}>Verify at {captionUrl}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Issued {issuedAt}</Text>
              <Text style={styles.metaText}>
                Agent ID: {agentNumber} | Certificate ID: {certificateId}
              </Text>
            </View>

            <View style={styles.signature}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>Ifeanyi Bryan</Text>
              <Text style={styles.signatureRole}>Chief Executive Officer</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
