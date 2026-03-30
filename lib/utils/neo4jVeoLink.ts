/**
 * Cypher fragment: first non-empty Veo/video URL on Fixture.
 * Primary: `veoLink` (Google Sheet "VEO LINK" → ingestion). Fallbacks for legacy keys.
 */
export const CYPHER_FIXTURE_VEOLINK_COALESCE = `coalesce(
  CASE WHEN f.veoLink IS NOT NULL AND trim(toString(f.veoLink)) <> '' THEN trim(toString(f.veoLink)) END,
  CASE WHEN f.veo_link IS NOT NULL AND trim(toString(f.veo_link)) <> '' THEN trim(toString(f.veo_link)) END,
  CASE WHEN f.videoLink IS NOT NULL AND trim(toString(f.videoLink)) <> '' THEN trim(toString(f.videoLink)) END
)`;
