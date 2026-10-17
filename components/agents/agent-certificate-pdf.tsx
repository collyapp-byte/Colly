import {
  Document,
  Page,
  Text,
  View,
  Image,
  Svg,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";

/**
 * The agent certificate as a landscape A4 award.
 *
 * Layout, per the design mockup:
 * - warm cream page with a white rounded inner card inset ~10mm
 * - an orange bookmark ribbon in the top-right corner (white logo disc +
 *   "COLLY") with a V-cut tail
 * - a large orange "CERTIFICATE" / "OF COMPLETION" header on the left
 * - the holder's name over a rule, then the award copy
 * - a black QR verification code on the right
 * - a signature block anchored bottom-left
 *
 * @react-pdf/renderer constraints handled here:
 * - react-pdf's `<Image>` cannot rasterise SVG, so the caller supplies the
 *   PNG produced by `scripts/convert-logo.cjs`; the disc degrades gracefully
 *   when no logo is available.
 * - No custom font files ship with the repo, so text falls back to the
 *   built-in Helvetica/Helvetica-Bold.
 * - Only the ribbon tail uses an `<Svg>`; everything else is `<View>`/`<Text>`.
 */

export type AgentCertificatePdfProps = {
  fullName: string;
  agentNumber: string;
  certificateId: string;
  /**
   * Pre-formatted date string, or a `Date` (formatted here). A raw `Date`
   * rendered straight into `<Text>` crashes react-pdf's reconciler, so it is
   * always normalised to a string before rendering.
   */
  issuedAt: string | Date;
  verifyUrl: string;
  qrDataUrl: string;
  /** PNG data URI for the Colly logo. Optional so the PDF still builds without it. */
  logoSrc?: string;
};

/** Coerces a `Date` (or already-formatted string) into the certificate date. */
function formatIssuedAt(value: string | Date): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
  }
  return value;
}

const ORANGE = "#FF6600";
const CREAM = "#FFF5EE";
const CARD = "#FFFFFF";
const INK = "#111111";
const BODY = "#666666";

// The ribbon is drawn as an SVG so its bottom edge can be V-cut. react-pdf
// lengths are points (1mm ≈ 2.8346pt), so 20mm ≈ 57pt and 50mm ≈ 142pt.
const RIBBON_WIDTH = 57;
const RIBBON_HEIGHT = 142;

const styles = StyleSheet.create({
  page: {
    backgroundColor: CREAM,
    fontFamily: "Helvetica",
    // The 10mm padding leaves the cream border visible around the card.
    padding: "10mm",
  },
  card: {
    flexGrow: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    // `relative` anchors the absolute ribbon/QR/signature; `hidden` clips the
    // ribbon so it cannot bleed past the rounded card corners.
    position: "relative",
    overflow: "hidden",
  },

  // Bookmark ribbon (top-right)
  ribbon: {
    position: "absolute",
    top: 0,
    right: 40,
    width: RIBBON_WIDTH,
    height: RIBBON_HEIGHT,
    alignItems: "center",
  },
  ribbonShape: {
    position: "absolute",
    top: 0,
    left: 0,
    width: RIBBON_WIDTH,
    height: RIBBON_HEIGHT,
  },
  ribbonContent: {
    alignItems: "center",
    paddingTop: 10,
  },
  logoDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 22, height: 22 },
  ribbonWordmark: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: CARD,
    letterSpacing: 2,
    marginTop: 6,
  },

  // Left text column
  content: {
    paddingTop: "30mm",
    paddingLeft: "30mm",
    // Keep clear of the QR code anchored on the right.
    paddingRight: "80mm",
  },
  title: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
  },
  subtitle: {
    fontSize: 14,
    color: ORANGE,
    letterSpacing: 4,
    marginTop: 2,
  },
  certifies: {
    fontSize: 10,
    color: BODY,
    marginTop: "20mm",
  },
  name: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 6,
  },
  nameRule: {
    width: "120mm",
    height: 1,
    backgroundColor: INK,
    marginTop: 6,
  },
  award: {
    fontSize: 11,
    color: BODY,
    lineHeight: 1.5,
    marginTop: 8,
  },

  // Signature (bottom-left)
  signature: {
    position: "absolute",
    bottom: "30mm",
    left: "30mm",
  },
  signatureLine: {
    width: "60mm",
    height: 1,
    backgroundColor: INK,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  signatureRole: {
    fontSize: 9,
    color: BODY,
    marginTop: 2,
  },

  // QR code (right)
  qrBlock: {
    position: "absolute",
    right: "30mm",
    top: "50mm",
    alignItems: "center",
  },
  qr: { width: 120, height: 120 },
  qrCaption: {
    fontSize: 7,
    color: BODY,
    marginTop: 6,
    textAlign: "center",
    width: 120,
  },
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
  // Never render a raw Date into <Text>: react-pdf's reconciler rejects it.
  const issuedAtText = formatIssuedAt(issuedAt);

  return (
    <Document
      title={`Colly Agent Certificate - ${fullName}`}
      author="Colly"
      subject="Colly Agent Certification"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.card}>
          {/* Orange bookmark ribbon with a V-cut tail. */}
          <View style={styles.ribbon}>
            <View style={styles.ribbonShape}>
              <Svg
                width={RIBBON_WIDTH}
                height={RIBBON_HEIGHT}
                viewBox={`0 0 ${RIBBON_WIDTH} ${RIBBON_HEIGHT}`}
              >
                <Path
                  d={`M0 0 L${RIBBON_WIDTH} 0 L${RIBBON_WIDTH} ${
                    RIBBON_HEIGHT - 20
                  } L${RIBBON_WIDTH / 2} ${RIBBON_HEIGHT} L0 ${
                    RIBBON_HEIGHT - 20
                  } Z`}
                  fill={ORANGE}
                />
              </Svg>
            </View>
            <View style={styles.ribbonContent}>
              <View style={styles.logoDisc}>
                {/* react-pdf dislikes `null` children; fall back to an empty
                    View so the disc always has a real child element. */}
                {logoSrc ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image style={styles.logo} src={logoSrc} />
                ) : (
                  <View />
                )}
              </View>
              <Text style={styles.ribbonWordmark}>COLLY</Text>
            </View>
          </View>

          {/* Left column: headline, name and award copy. */}
          <View style={styles.content}>
            <Text style={styles.title}>CERTIFICATE</Text>
            <Text style={styles.subtitle}>OF COMPLETION</Text>

            <Text style={styles.certifies}>This certifies that</Text>
            <Text style={styles.name}>{fullName}</Text>
            <View style={styles.nameRule} />

            <View style={styles.award}>
              <Text>has successfully completed the</Text>
              <Text>{"“Colly Agent Certification Programme”"}</Text>
              <Text>conducted by Colly</Text>
              <Text>on {issuedAtText}, in Nigeria</Text>
            </View>
          </View>

          {/* QR verification code. */}
          <View style={styles.qrBlock}>
            {/* react-pdf's Image has no `alt` prop; the QR is decorative here
                because the verification URL is printed beneath it. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.qr} src={qrDataUrl} />
            <Text style={styles.qrCaption}>Verify at {captionUrl}</Text>
            <Text style={styles.qrCaption}>
              Agent ID: {agentNumber} | Certificate ID: {certificateId}
            </Text>
          </View>

          {/* Signature. */}
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>Ifeanyi Bryan</Text>
            <Text style={styles.signatureRole}>Chief Executive Officer</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
