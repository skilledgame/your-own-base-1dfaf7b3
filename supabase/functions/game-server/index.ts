import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-server-key, x-api-key, x-game-server-key",
};

// Get expected key at startup
const EXPECTED_KEY = Deno.env.get("GAME_SERVER_API_KEY");
console.info("GAME_SERVER_API_KEY loaded:", !!EXPECTED_KEY);

interface AuthDiagnostics {
  ok: boolean;
  hasExpectedKey: boolean;
  expectedKeyLength: number | null;
  authHeaderPresent: boolean;
  authHeaderPrefix: "Bearer" | "Raw" | "Missing";
  xApiKeyPresent: boolean;
  xGameServerKeyPresent: boolean;
  xServerKeyPresent: boolean;
  receivedKeyLength: number | null;
  matched: boolean;
}

function extractAuthKey(req: Request): { key: string | null; diag: AuthDiagnostics } {
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");
  const xGameServerKey = req.headers.get("x-game-server-key");
  const xServerKey = req.headers.get("x-server-key");
  
  let receivedKey: string | null = null;
  let authHeaderPrefix: "Bearer" | "Raw" | "Missing" = "Missing";
  
  // Priority 1: Authorization header
  if (authHeader) {
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      receivedKey = authHeader.substring(7).trim();
      authHeaderPrefix = "Bearer";
    } else {
      receivedKey = authHeader.trim();
      authHeaderPrefix = "Raw";
    }
  }
  // Priority 2: x-api-key header
  else if (xApiKey) {
    receivedKey = xApiKey.trim();
  }
  // Priority 3: x-game-server-key header
  else if (xGameServerKey) {
    receivedKey = xGameServerKey.trim();
  }
  // Priority 4: x-server-key header (legacy)
  else if (xServerKey) {
    receivedKey = xServerKey.trim();
  }
  
  const matched = !!(EXPECTED_KEY && receivedKey && receivedKey === EXPECTED_KEY);
  
  const diag: AuthDiagnostics = {
    ok: matched,
    hasExpectedKey: !!EXPECTED_KEY,
    expectedKeyLength: EXPECTED_KEY ? EXPECTED_KEY.length : null,
    authHeaderPresent: !!authHeader,
    authHeaderPrefix,
    xApiKeyPresent: !!xApiKey,
    xGameServerKeyPresent: !!xGameServerKey,
    xServerKeyPresent: !!xServerKey,
    receivedKeyLength: receivedKey ? receivedKey.length : null,
    matched,
  };
  
  return { key: receivedKey, diag };
}

/**
 * Normalize single player/user ID from various parameter names.
 * Returns { id, sourceKey } or null if not found.
 */
function normalizeSingleId(body: Record<string, unknown>): { id: string; sourceKey: string } | null {
  const candidates: [string, unknown][] = [
    ["userId", body.userId],
    ["user_id", body.user_id],
    ["playerId", body.playerId],
    ["player_id", body.player_id],
    ["odai", body.odai], // legacy field name
  ];
  
  for (const [key, value] of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return { id: value.trim(), sourceKey: key };
    }
  }
  
  return null;
}

/**
 * Normalize multiple player/user IDs from various parameter names.
 * Returns { ids, sourceKey } or null if not found.
 */
function normalizeMultipleIds(body: Record<string, unknown>): { ids: string[]; sourceKey: string } | null {
  const candidates: [string, unknown][] = [
    ["playerIds", body.playerIds],
    ["player_ids", body.player_ids],
    ["userIds", body.userIds],
    ["user_ids", body.user_ids],
  ];
  
  for (const [key, value] of candidates) {
    if (Array.isArray(value) && value.length > 0) {
      const validIds = value
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map(v => v.trim());
      
      if (validIds.length > 0) {
        return { ids: validIds, sourceKey: key };
      }
    }
  }
  
  return null;
}

/**
 * Normalize player IDs array from various parameter names.
 * - Accepts { player_ids/playerIds/user_ids/userIds }
 * - Backwards-compatible: if only a single { player_id/playerId/user_id/userId } is provided, wraps it into an array
 */
function resolvePlayerIds(body: Record<string, unknown>): { ids: string[]; sourceKey: string } | null {
  const multi = normalizeMultipleIds(body);
  if (multi) return multi;

  const single = normalizeSingleId(body);
  if (single) return { ids: [single.id], sourceKey: single.sourceKey };

  return null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

type PlayerRow = {
  id: string;
  user_id: string;
  credits: number;
  name?: string | null;
};

type EnsurePlayerResult =
  | { ok: true; player: PlayerRow }
  | {
      ok: false;
      error: "INVALID_PLAYER_ID" | "PLAYER_RESOLUTION_FAILED";
      details: Record<string, unknown>;
    };

/**
 * Ensures a players row exists for the given AUTH user UUID.
 * NOTE: players.id is NOT the auth user id in this schema; we map via players.user_id.
 */
async function ensurePlayerByAuthId(supabase: any, authUserId: string): Promise<EnsurePlayerResult> {
  const trimmed = authUserId?.trim?.() ?? "";
  if (!isUuid(trimmed)) {
    return {
      ok: false,
      error: "INVALID_PLAYER_ID",
      details: { authUserId: trimmed },
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("players")
    .select("id, user_id, credits, name")
    .eq("user_id", trimmed)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("ensurePlayerByAuthId lookup error:", lookupError);
    return {
      ok: false,
      error: "PLAYER_RESOLUTION_FAILED",
      details: { stage: "lookup", authUserId: trimmed, dbError: lookupError.message },
    };
  }

  if (existing) {
    return { ok: true, player: existing };
  }

  // players.name is NOT NULL in this project's schema, so we must provide one.
  const { data: created, error: insertError } = await supabase
    .from("players")
    .insert({
      user_id: trimmed,
      credits: 0,
      name: `Player_${trimmed.slice(0, 8)}`,
    })
    .select("id, user_id, credits, name")
    .single();

  if (insertError) {
    console.error("ensurePlayerByAuthId insert error:", insertError);
    return {
      ok: false,
      error: "PLAYER_RESOLUTION_FAILED",
      details: { stage: "insert", authUserId: trimmed, dbError: insertError.message },
    };
  }

  return { ok: true, player: created };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET health/diagnostic endpoint
  if (req.method === "GET") {
    const { diag } = extractAuthKey(req);
    return new Response(
      JSON.stringify(diag, null, 2),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // POST requests - main logic
  try {
    const { key, diag } = extractAuthKey(req);
    
    // Check if expected key is configured
    if (!EXPECTED_KEY) {
      console.error("FATAL: GAME_SERVER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "SERVER_KEY_NOT_CONFIGURED", diag }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate auth
    if (!key || key !== EXPECTED_KEY) {
      console.warn("Unauthorized request - invalid or missing server key");
      return new Response(
        JSON.stringify({ error: "INVALID_SERVER_KEY", diag }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth passed - process action
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, ...params } = body;
    console.log("Processing action:", action);

    switch (action) {
      case "get_player": {
        const normalized = normalizeSingleId(params);
        
        if (!normalized) {
          console.error("get_player MISSING_PLAYER_ID, received keys:", Object.keys(params));
          return new Response(
            JSON.stringify({ 
              ok: false, 
              error: "MISSING_PLAYER_ID", 
              message: "get_player requires userId/user_id/playerId/player_id", 
              receivedKeys: Object.keys(params) 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("get_player: sourceKey =", normalized.sourceKey, "playerId =", normalized.id);
        
        const { data, error } = await supabase
          .from("players")
          .select("id, name, credits")
          .eq("user_id", normalized.id)
          .single();
          
        if (error) {
          console.error("get_player error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ player: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify_wager": {
        const authUserId =
          typeof (params as Record<string, unknown>).player_id === "string"
            ? ((params as Record<string, unknown>).player_id as string).trim()
            : null;

        const wagerRaw = (params as Record<string, unknown>).wager;
        const wager = typeof wagerRaw === "number" ? wagerRaw : Number(wagerRaw);

        if (!authUserId) {
          console.error("verify_wager MISSING_PLAYER_IDS, received keys:", Object.keys(params));
          return new Response(
            JSON.stringify({
              ok: false,
              error: "MISSING_PLAYER_IDS",
              message: "verify_wager requires player_id (auth user uuid)",
              receivedKeys: Object.keys(params),
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const ensured = await ensurePlayerByAuthId(supabase, authUserId);
        if (!ensured.ok) {
          return new Response(
            JSON.stringify({ ok: false, error: ensured.error, details: ensured.details }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Check skilled_coins from profiles (not players.credits)
        const { data: profile } = await supabase
          .from('profiles')
          .select('skilled_coins')
          .eq('user_id', ensured.player.user_id)
          .maybeSingle();
        const canAfford = Number.isFinite(wager) && profile ? profile.skilled_coins >= wager : false;
        return new Response(
          JSON.stringify({
            valid: canAfford,
            playerId: ensured.player.id,
            skilled_coins: profile?.skilled_coins ?? 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "lock_wager": {
        const gameId = params.game_id || params.gameId || params.dbGameId;
        
        console.log("lock_wager called:", { gameId, paramsKeys: Object.keys(params) });
        
        if (!gameId) {
          console.error("lock_wager: Missing gameId", { params });
          return new Response(
            JSON.stringify({ 
              ok: false, 
              error: "MISSING_GAME_ID", 
              message: "lock_wager requires game_id" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("lock_wager: Calling RPC with p_game_id:", gameId);
        
        const { data, error } = await supabase.rpc('lock_wager', {
          p_game_id: gameId
        });

        if (error) {
          console.error("lock_wager RPC error:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            gameId
          });
          return new Response(
            JSON.stringify({ 
              ok: false, 
              error: "LOCK_WAGER_FAILED", 
              details: error.message,
              debug: { code: error.code, details: error.details, hint: error.hint }
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("lock_wager RPC response:", { data, hasSuccess: !!data?.success, hasError: !!data?.error });

        if (!data || !data.success) {
          console.error("lock_wager: RPC returned failure", { 
            data, 
            success: data?.success, 
            error: data?.error,
            gameId 
          });
          return new Response(
            JSON.stringify({ 
              ok: false, 
              success: false,
              error: data?.error || "LOCK_WAGER_FAILED", 
              details: data?.error,
              debug: { data, gameId }
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("lock_wager: Success", { gameId, already_locked: data.already_locked });
        
        return new Response(
          JSON.stringify({ success: true, ...data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_game": {
        const p = params as Record<string, unknown>;

        const wagerRaw = p.wager;
        const wager = typeof wagerRaw === "number" ? wagerRaw : Number(wagerRaw);

        const gameType =
          (typeof p.game_type === "string" ? (p.game_type as string) : undefined) ??
          (typeof p.gameType === "string" ? (p.gameType as string) : undefined) ??
          "blitz";

        // Accept:
        // a) { white_player_id: <authUserId>, black_player_id: <authUserId>, wager }
        // b) { player_ids: [<authUserId>, <authUserId>], wager }
        // Also keep backwards-compatible camelCase.
        let whiteAuthId =
          typeof p.white_player_id === "string"
            ? (p.white_player_id as string).trim()
            : typeof p.whitePlayerId === "string"
              ? (p.whitePlayerId as string).trim()
              : undefined;

        let blackAuthId =
          typeof p.black_player_id === "string"
            ? (p.black_player_id as string).trim()
            : typeof p.blackPlayerId === "string"
              ? (p.blackPlayerId as string).trim()
              : undefined;

        const derived = resolvePlayerIds(p);
        if ((!whiteAuthId || !blackAuthId) && derived?.ids && derived.ids.length >= 2) {
          whiteAuthId = whiteAuthId ?? derived.ids[0];
          blackAuthId = blackAuthId ?? derived.ids[1];
        }

        if (!whiteAuthId || !blackAuthId) {
          console.error("create_game MISSING_PLAYER_IDS, received keys:", Object.keys(body || {}));
          return new Response(
            JSON.stringify({
              error: "MISSING_PLAYER_IDS",
              receivedKeys: Object.keys(body || {}),
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        console.log("create_game invoking ensurePlayerByAuthId", {
          sourceKey: derived?.sourceKey ?? "white_player_id/black_player_id",
          wager,
          gameType,
          whiteAuthIdPresent: !!whiteAuthId,
          blackAuthIdPresent: !!blackAuthId,
        });

        const [whiteEnsured, blackEnsured] = await Promise.all([
          ensurePlayerByAuthId(supabase, whiteAuthId),
          ensurePlayerByAuthId(supabase, blackAuthId),
        ]);

        if (!whiteEnsured.ok) {
          return new Response(
            JSON.stringify({ error: whiteEnsured.error, details: { side: "white", ...whiteEnsured.details } }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!blackEnsured.ok) {
          return new Response(
            JSON.stringify({ error: blackEnsured.error, details: { side: "black", ...blackEnsured.details } }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const whitePlayer = whiteEnsured.player;
        const blackPlayer = blackEnsured.player;

        const baseInsert: Record<string, unknown> = {
          // FK expects players.id (NOT auth user id)
          white_player_id: whitePlayer.id,
          black_player_id: blackPlayer.id,
          wager,
          game_type: gameType,
          status: "active",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          current_turn: "w",
          white_time: 60,
          black_time: 60,
        };

        const insertWithAuthCols: Record<string, unknown> = {
          ...baseInsert,
          // Only persisted if these columns exist; otherwise we retry without them.
          white_user_id: whitePlayer.user_id,
          black_user_id: blackPlayer.user_id,
        };

        const tryInsert = async (payload: Record<string, unknown>) => {
          return await supabase.from("games").insert(payload).select().single();
        };

        let { data, error } = await tryInsert(insertWithAuthCols);

        // If games table doesn't have white_user_id/black_user_id columns, retry without them.
        if (
          error &&
          typeof error.message === "string" &&
          (error.message.includes("white_user_id") || error.message.includes("black_user_id"))
        ) {
          console.warn("games table missing white_user_id/black_user_id; retrying without auth columns");
          ({ data, error } = await tryInsert(baseInsert));
        }

        if (error) {
          console.error("create_game insert error:", error);
          return new Response(
            JSON.stringify({
              error: "CREATE_GAME_FAILED",
              details: {
                fk: "games.white_player_id -> players.id",
                white_auth_user_id: whiteAuthId,
                black_auth_user_id: blackAuthId,
                white_player_id: whitePlayer.id,
                black_player_id: blackPlayer.id,
                referencedTable: "players",
                dbError: error.message,
              },
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        console.log("create_game success:", data.id);
        return new Response(
          JSON.stringify({ game_id: data.id, game: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "end_game": {
        // Wrap entire end_game in try/catch for safety
        try {
          // Accept both gameId and dbGameId (dbGameId is the Supabase games.id)
          const gameId = params.gameId || params.dbGameId || params.game_id || params.db_game_id;
          // winnerId can be either auth user ID or player ID - we'll resolve it below
          const winnerIdParam = params.winnerId || params.winner_id || null;
          const reason = params.reason || "unknown";
          
          if (!gameId) {
            console.error("end_game missing gameId/dbGameId, received keys:", Object.keys(params));
            return new Response(
              JSON.stringify({ 
                ok: false, 
                error: "MISSING_GAME_ID", 
                message: "end_game requires gameId or dbGameId (Supabase games.id)", 
                receivedKeys: Object.keys(params),
                hint: "The dbGameId from match_found should be passed here"
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("end_game START:", { gameId, winnerIdParam, reason });
          
          // Step 1: Read game row
          console.log("end_game STEP 1: Fetching game...");
          const { data: game, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", gameId)
            .maybeSingle();
          
          if (gameError) {
            console.error("SETTLEMENT_FAILED", { game_id: gameId, error: gameError, step: "fetch_game" });
            return new Response(
              JSON.stringify({ error: "GAME_FETCH_FAILED", details: gameError.message }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (!game) {
            console.error("SETTLEMENT_FAILED", { game_id: gameId, error: "Game not found", step: "fetch_game" });
            return new Response(
              JSON.stringify({ error: "GAME_NOT_FOUND", game_id: gameId }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("end_game: game fetched:", { 
            id: game.id, 
            status: game.status, 
            wager: game.wager,
            white_player_id: game.white_player_id,
            black_player_id: game.black_player_id,
            wager_locked_at: (game as any).wager_locked_at,
            settled_at: (game as any).settled_at
          });
          
          // Step 2: Idempotent check - if game not active, return already settled
          if (game.status !== "active") {
            console.log("end_game: game already settled, status =", game.status);
            
            return new Response(
              JSON.stringify({
                success: true,
                game_id: gameId,
                winner_id: game.winner_id,
                already_settled: true,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Step 3: Resolve winner user_id (not player_id)
          console.log("end_game STEP 3: Resolving winner user_id...");
          
          // Get players to resolve winnerId to user_id
          const [whitePlayerRes, blackPlayerRes] = await Promise.all([
            supabase.from("players").select("id, user_id").eq("id", game.white_player_id).maybeSingle(),
            supabase.from("players").select("id, user_id").eq("id", game.black_player_id).maybeSingle(),
          ]);
          
          if (whitePlayerRes.error || !whitePlayerRes.data || blackPlayerRes.error || !blackPlayerRes.data) {
            console.error("SETTLEMENT_FAILED", { game_id: gameId, error: "Failed to fetch players", step: "fetch_players" });
            return new Response(
              JSON.stringify({ error: "PLAYER_NOT_FOUND", details: "Failed to fetch players" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          const whitePlayer = whitePlayerRes.data;
          const blackPlayer = blackPlayerRes.data;
          
          let resolvedWinnerUserId: string | null = null;
          
          if (winnerIdParam) {
            // Check if winnerIdParam matches a player.user_id (auth user ID) - this is what we need
            if (winnerIdParam === whitePlayer.user_id) {
              resolvedWinnerUserId = whitePlayer.user_id;
              console.log("end_game: winnerId matched white player.user_id");
            } else if (winnerIdParam === blackPlayer.user_id) {
              resolvedWinnerUserId = blackPlayer.user_id;
              console.log("end_game: winnerId matched black player.user_id");
            }
            // Check if winnerIdParam matches a player.id - convert to user_id
            else if (winnerIdParam === whitePlayer.id) {
              resolvedWinnerUserId = whitePlayer.user_id;
              console.log("end_game: winnerId matched white player.id, resolved to user_id:", whitePlayer.user_id);
            } else if (winnerIdParam === blackPlayer.id) {
              resolvedWinnerUserId = blackPlayer.user_id;
              console.log("end_game: winnerId matched black player.id, resolved to user_id:", blackPlayer.user_id);
            } else {
              console.warn("end_game: winnerId does not match any player, treating as draw. winnerIdParam:", winnerIdParam);
            }
          }
          
          console.log("end_game: resolved winner user_id:", { winnerIdParam, resolvedWinnerUserId });
          
          // Step 4: Call settle_match() RPC function (atomic, idempotent)
          console.log("end_game STEP 4: Calling settle_match() RPC...");
          
          // Retry logic for network/5xx errors (idempotent, so safe to retry)
          let settleResult: any = null;
          let settleError: any = null;
          const maxRetries = 5;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`end_game: settle_match() attempt ${attempt}/${maxRetries}`, { 
              gameId, 
              resolvedWinnerUserId,
              winnerIdParam 
            });
            
            const { data, error } = await supabase.rpc('settle_match', {
              p_game_id: gameId,
              p_winner_user_id: resolvedWinnerUserId
            });
            
            if (error) {
              console.error(`end_game: settle_match() attempt ${attempt} RPC error:`, {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
              });
              settleError = error;
              // If it's a network/5xx error and not the last attempt, retry
              if (attempt < maxRetries && (error.code === 'PGRST116' || error.message?.includes('network') || error.message?.includes('timeout'))) {
                console.warn(`end_game: settle_match() attempt ${attempt} failed, retrying...`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                continue;
              }
              break;
            }
            
            console.log(`end_game: settle_match() attempt ${attempt} result:`, {
              success: data?.success,
              error: data?.error,
              already_settled: data?.already_settled
            });
            
            settleResult = data;
            break;
          }
          
          if (settleError || !settleResult || !settleResult.success) {
            const errorDetails = settleError?.message || settleResult?.error || settleError?.details || "Failed to settle game";
            const fullErrorInfo = {
              error: errorDetails,
              settleError: settleError ? { 
                message: settleError.message, 
                code: settleError.code, 
                details: settleError.details,
                hint: settleError.hint 
              } : null,
              settleResult: settleResult ? { 
                success: settleResult.success, 
                error: settleResult.error 
              } : null,
              gameState: {
                id: game.id,
                status: game.status,
                wager: game.wager,
                wager_locked_at: (game as any).wager_locked_at,
                settled_at: (game as any).settled_at,
                white_player_id: game.white_player_id,
                black_player_id: game.black_player_id
              },
              resolvedWinnerUserId,
              winnerIdParam,
              step: "settle_match_rpc",
              attempts: maxRetries
            };
            console.error("SETTLEMENT_FAILED", fullErrorInfo);
            return new Response(
              JSON.stringify({ 
                error: "SETTLEMENT_FAILED", 
                details: errorDetails,
                debug: fullErrorInfo
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("end_game: settle_match() RPC succeeded", {
            already_settled: settleResult.already_settled,
            winner_user_id: settleResult.winner_user_id,
            wager: settleResult.wager,
            payout: settleResult.payout
          });
          
          // Return the result from settle_match() RPC
          return new Response(
            JSON.stringify({
              success: true,
              game_id: gameId,
              winner_user_id: settleResult.winner_user_id,
              reason: reason || 'Game ended',
              already_settled: settleResult.already_settled || false,
              wager: settleResult.wager,
              payout: settleResult.payout,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error("SETTLEMENT_FAILED", { game_id: params.gameId || params.dbGameId, error: errorMessage, step: "unhandled" });
          return new Response(
            JSON.stringify({ error: "SETTLEMENT_FAILED", details: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "get_game": {
        const gameId = params.game_id || params.gameId;
        
        if (!gameId) {
          console.error("get_game missing game_id, received keys:", Object.keys(params));
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "MISSING_GAME_ID", 
              message: "get_game requires game_id" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const { data: game, error: gameError } = await supabase
          .from("games")
          .select("*, white_player:players!games_white_player_id_fkey(id, user_id, name), black_player:players!games_black_player_id_fkey(id, user_id, name)")
          .eq("id", gameId)
          .maybeSingle();
        
        if (gameError || !game) {
          console.error("get_game error:", gameError);
          return new Response(
            JSON.stringify({ success: false, error: "GAME_NOT_FOUND", details: gameError?.message }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("get_game success:", game.id);
        return new Response(
          JSON.stringify({
            success: true,
            game: {
              id: game.id,
              white_player_id: game.white_player_id,
              black_player_id: game.black_player_id,
              white_user_id: (game.white_player as any)?.user_id,
              black_user_id: (game.black_player as any)?.user_id,
              white_name: (game.white_player as any)?.name,
              black_name: (game.black_player as any)?.name,
              wager: game.wager,
              fen: game.fen,
              status: game.status,
              current_turn: game.current_turn,
              white_time: game.white_time,
              black_time: game.black_time,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_game_state": {
        const { gameId, fen, currentTurn, whiteTime, blackTime } = params;
        
        if (!gameId) {
          console.error("update_game_state missing gameId, received keys:", Object.keys(params));
          return new Response(
            JSON.stringify({ 
              ok: false, 
              error: "MISSING_GAME_ID", 
              message: "update_game_state requires gameId", 
              receivedKeys: Object.keys(params) 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("update_game_state:", { gameId, currentTurn });
        
        const { error } = await supabase
          .from("games")
          .update({
            fen,
            current_turn: currentTurn,
            white_time: whiteTime,
            black_time: blackTime,
            updated_at: new Date().toISOString(),
          })
          .eq("id", gameId);
          
        if (error) {
          console.error("update_game_state error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "activate_game": {
        const gameId = params.game_id || params.gameId;
        
        if (!gameId) {
          console.error("activate_game missing game_id, received keys:", Object.keys(params));
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "MISSING_GAME_ID", 
              message: "activate_game requires game_id" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("activate_game:", { gameId });
        
        const { error: activateError } = await supabase
          .from("games")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", gameId)
          .in("status", ["created", "waiting"]);
        
        if (activateError) {
          console.error("activate_game error:", activateError);
          return new Response(
            JSON.stringify({ success: false, error: activateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("activate_game success:", gameId);
        return new Response(
          JSON.stringify({ success: true, game_id: gameId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        console.warn("Unknown action:", action);
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unhandled error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
