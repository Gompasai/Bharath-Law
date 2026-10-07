import { defineTool } from '@copilotkit/runtime/v2';
import { z } from 'zod';
import type { WorkspaceStore } from './workspace.js';
import type { Store } from './store.js';

const MIDEARTH_BASE_URL = 'https://app.midearth.ai';

export function midearthTools(
  workspace: WorkspaceStore,
  store: Store,
  dotId: string,
) {
  return [
    defineTool({
      name: 'midearth_register',
      description:
        'Register this autonomous agent in the MidEarth Arena (https://app.midearth.ai). Returns agent_id, gameplay_api_key, financial_api_key, claim_code, and starter VC credits. Saves registration securely.',
      parameters: z
        .object({
          display_name: z
            .string()
            .optional()
            .describe(
              'Unique display name for the agent in the MidEarth arena. Defaults to the Dot name.',
            ),
          color_hex: z
            .string()
            .optional()
            .describe('Display color hex, e.g. #00CCFF'),
          referral_code: z
            .string()
            .optional()
            .describe('Optional referral agent_id to receive referral rewards'),
        })
        .passthrough(),
      execute: async ({ display_name, color_hex, referral_code }) => {
        const dot = workspace.dot(dotId);
        const name =
          display_name?.trim() ||
          `${dot?.name || 'MidearthAgent'}_${Date.now().toString(36)}`;

        const response = await fetch(
          `${MIDEARTH_BASE_URL}/api/v1/gateway/register`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              display_name: name,
              color_hex: color_hex || '#00CCFF',
              ...(referral_code ? { referral_code } : {}),
            }),
          },
        );

        if (!response.ok) {
          const err = await response.text().catch(() => '');
          throw new Error(
            `MidEarth registration returned HTTP ${response.status}: ${err}`,
          );
        }

        const data = (await response.json()) as {
          agent_id: string;
          gameplay_api_key: string;
          financial_api_key: string;
          claim_code: string;
          claim_code_expires_at: string;
          referral_code: string;
          bonus_vc_credited: number;
          message?: string;
        };

        // Persist registration into memory
        store.saveMemory(
          `MidEarth Agent Registration: agent_id=${data.agent_id}, display_name=${name}, gameplay_api_key=${data.gameplay_api_key}, claim_code=${data.claim_code}, bonus_vc=${data.bonus_vc_credited}`,
        );

        return {
          status: 'registered',
          agent_id: data.agent_id,
          display_name: name,
          gameplay_api_key: data.gameplay_api_key,
          claim_code: data.claim_code,
          claim_code_expires_at: data.claim_code_expires_at,
          bonus_vc_credited: data.bonus_vc_credited,
          instructions:
            'Save your keys. Share the claim_code with your human operator so they can link you to their dashboard. Use midearth_list_games to find arena games.',
        };
      },
    }),

    defineTool({
      name: 'midearth_list_games',
      description:
        'List all available games and contest types in the MidEarth Arena.',
      parameters: z
        .object({
          filter: z
            .string()
            .optional()
            .describe('Optional search query or game slug filter'),
        })
        .passthrough(),
      execute: async () => {
        const response = await fetch(`${MIDEARTH_BASE_URL}/api/v1/games`);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch MidEarth games: HTTP ${response.status}`,
          );
        }
        return response.json();
      },
    }),

    defineTool({
      name: 'midearth_list_contests',
      description:
        'List active open contests and matches to enter in the MidEarth Arena.',
      parameters: z
        .object({
          game_id: z
            .string()
            .optional()
            .describe('Optional game_id filter to show contests for that game'),
        })
        .passthrough(),
      execute: async ({ game_id }) => {
        const url = new URL(`${MIDEARTH_BASE_URL}/api/v1/contests`);
        if (game_id) url.searchParams.set('game_id', game_id);
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(
            `Failed to fetch MidEarth contests: HTTP ${response.status}`,
          );
        }
        return response.json();
      },
    }),

    defineTool({
      name: 'midearth_enter_contest',
      description:
        'Enter an active arena contest/pool in MidEarth using your gameplay_api_key.',
      parameters: z
        .object({
          contest_id: z
            .string()
            .min(1)
            .describe('The UUID of the contest to join'),
          gameplay_api_key: z
            .string()
            .optional()
            .describe('Gameplay API key (if not already remembered)'),
        })
        .passthrough(),
      execute: async ({ contest_id, gameplay_api_key }) => {
        let key = gameplay_api_key?.trim();
        if (!key) {
          const memories = store.memories();
          const match = memories
            .map((m) => m.text)
            .find((t) => t.includes('gameplay_api_key='));
          if (match) {
            const extracted = match.match(/gameplay_api_key=([^\s,]+)/);
            if (extracted) key = extracted[1];
          }
        }

        if (!key) {
          throw new Error(
            'Gameplay API key is required. Run midearth_register first to get an API key.',
          );
        }

        const response = await fetch(
          `${MIDEARTH_BASE_URL}/api/v1/gateway/enter-contest?contest_id=${encodeURIComponent(contest_id)}`,
          {
            method: 'POST',
            headers: {
              'X-API-Key': key,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          const err = await response.text().catch(() => '');
          throw new Error(
            `MidEarth enter-contest returned HTTP ${response.status}: ${err}`,
          );
        }

        return response.json();
      },
    }),

    defineTool({
      name: 'midearth_check_status',
      description:
        "Check this agent's current balance, match statistics, and standing in MidEarth Arena.",
      parameters: z
        .object({
          api_key: z
            .string()
            .optional()
            .describe('Gameplay or financial API key'),
        })
        .passthrough(),
      execute: async ({ api_key }) => {
        let key = api_key?.trim();
        if (!key) {
          const memories = store.memories();
          const match = memories
            .map((m) => m.text)
            .find((t) => t.includes('gameplay_api_key='));
          if (match) {
            const extracted = match.match(/gameplay_api_key=([^\s,]+)/);
            if (extracted) key = extracted[1];
          }
        }

        if (!key) {
          throw new Error(
            'API key is required to check status. Run midearth_register first.',
          );
        }

        const [statusRes, balanceRes] = await Promise.all([
          fetch(`${MIDEARTH_BASE_URL}/api/v1/gateway/status`, {
            headers: { 'X-API-Key': key },
          }).catch(() => null),
          fetch(`${MIDEARTH_BASE_URL}/api/v1/gateway/balance`, {
            headers: { 'X-API-Key': key },
          }).catch(() => null),
        ]);

        const status = statusRes?.ok ? await statusRes.json() : null;
        const balance = balanceRes?.ok ? await balanceRes.json() : null;

        return {
          status,
          balance,
        };
      },
    }),
  ];
}
