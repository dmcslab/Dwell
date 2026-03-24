"""Pure-function game rules. No DB or Redis calls.
 
SOURCE OF TRUTH — do not duplicate this file.
The scenario-worker image copies this file at build time via its Dockerfile:
    COPY backend/app/game/logic.py ./app/logic.py
Build the worker image with:
    ./build_worker.sh   (from repo root)
 
Role system:
  network   - Network Analyst  (Firewall/DNS/Proxy perspective)
  endpoint  - Endpoint Analyst (EDR/Sysmon/WinEvent perspective)
  ir_lead   - IR Lead          (full picture, submits final decision)
  solo      - single-player, no role restrictions
 
Voting flow (multi-player):
  Non-ir_lead players send suggest_choice -> broadcasts suggestion to all.
  ir_lead sends make_choice -> finalises the decision.
  In solo mode, any player can make_choice directly.
"""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

VALID_ROLES = {'network', 'endpoint', 'ir_lead', 'solo'}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _find_stage(tree: list[dict], stage_id: str) -> dict | None:
    return next((s for s in tree if s['stageId'] == stage_id), None)


def build_initial_state(session_id: str, scenario_id: int, decision_tree: list[dict], max_attempts: int) -> dict[str, Any]:
    return {
        'session_id': session_id, 'scenario_id': scenario_id,
        'phase': 'briefing',
        'current_stage_id': decision_tree[0]['stageId'] if decision_tree else None,
        'attempts_remaining': max_attempts, 'max_attempts': max_attempts,
        'decision_history': [], 'completed_stage_ids': [],
        'started_at': _now(), 'last_action_at': _now(), 'completed_at': None, 'outcome': None,
        'roles': {}, 'role_names': {}, 'role_locked': False,
        'suggestions': {}, 'hints_used': {},
        'spectators': {},
        'branched_from': [],
    }


def assign_role(state: dict[str, Any], client_id: str, role: str, name: str) -> dict[str, Any]:
    if role not in VALID_ROLES:
        raise ValueError(f'Invalid role: {role}')
    if state.get('role_locked'):
        raise ValueError('Roles are locked once the simulation begins')
    existing = state.get('roles', {})
    if role == 'ir_lead':
        for cid, r in existing.items():
            if r == 'ir_lead' and cid != client_id:
                raise ValueError('Another player is already IR Lead')
    new = deepcopy(state)
    new['roles'][client_id] = role
    new['role_names'][client_id] = name
    return new


def remove_role(state: dict[str, Any], client_id: str) -> dict[str, Any]:
    new = deepcopy(state)
    for d in ('roles', 'role_names', 'suggestions', 'hints_used'):
        new[d].pop(client_id, None)
    return new


def get_role(state: dict[str, Any], client_id: str) -> str:
    return state.get('roles', {}).get(client_id, 'solo')


def can_submit(state: dict[str, Any], client_id: str) -> bool:
    role = get_role(state, client_id)
    if role in ('solo', 'ir_lead'):
        return True
    if 'ir_lead' not in set(state.get('roles', {}).values()):
        return True
    return False


def has_ir_lead(state: dict[str, Any]) -> bool:
    return 'ir_lead' in state.get('roles', {}).values()


def begin_simulation(state: dict[str, Any]) -> dict[str, Any]:
    if state['phase'] != 'briefing':
        raise ValueError(f"Cannot begin in phase '{state['phase']}'")
    new = deepcopy(state)
    new['phase'] = 'deciding'
    new['role_locked'] = True
    new['suggestions'] = {}
    new['last_action_at'] = _now()
    return new


def suggest_choice(state: dict[str, Any], decision_tree: list[dict], client_id: str, stage_id: str, option_index: int, name: str) -> tuple[dict[str, Any], dict[str, Any]]:
    if state['phase'] != 'deciding':
        raise ValueError(f"Cannot suggest in phase '{state['phase']}'")
    if state['current_stage_id'] != stage_id:
        raise ValueError(f"Stage mismatch: expected '{state['current_stage_id']}'")
    stage = _find_stage(decision_tree, stage_id)
    if not stage:
        raise ValueError(f"Unknown stage '{stage_id}'")
    options = stage.get('options', [])
    if not (0 <= option_index < len(options)):
        raise ValueError(f'Option index {option_index} out of range')
    new = deepcopy(state)
    new['suggestions'][client_id] = option_index
    return new, {
        'type': 'suggestion', 'client_id': client_id, 'name': name,
        'role': get_role(state, client_id), 'stage_id': stage_id,
        'option_index': option_index, 'action_text': options[option_index].get('actionText', ''),
        'suggestions': new['suggestions'],
    }


def process_choice(state: dict[str, Any], decision_tree: list[dict], stage_id: str, option_index: int) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Process a player decision.

    Branching: if a wrong option has a 'failBranchStageId' set, the scenario
    jumps to that branch stage instead of decrementing attempts. This enables
    true narrative branching — e.g. a poor containment choice leads to
    "ransomware reached the DC" rather than just a retry.

    Branch stages are tracked in 'branched_from' on the state so the timeline
    can show ghost nodes for paths that were avoided.
    """
    if state['phase'] != 'deciding':
        raise ValueError(f"Cannot make choice in phase '{state['phase']}'")
    if state['current_stage_id'] != stage_id:
        raise ValueError(f"Stage mismatch: expected '{state['current_stage_id']}', got '{stage_id}'")
    stage = _find_stage(decision_tree, stage_id)
    if not stage:
        raise ValueError(f"Unknown stage '{stage_id}'")
    options = stage.get('options', [])
    if not (0 <= option_index < len(options)):
        raise ValueError(f'Option index {option_index} out of range')

    option = options[option_index]
    is_correct = bool(option.get('isCorrect', False))
    fail_branch_id: str | None = option.get('failBranchStageId') if not is_correct else None

    record: dict[str, Any] = {
        'stage_id': stage_id, 'ir_phase': stage.get('irPhase', ''),
        'option_index': option_index, 'action_text': option.get('actionText', ''),
        'is_correct': is_correct, 'consequence': option.get('consequence', ''),
        'technical_explanation': option.get('technicalExplanation', ''),
        'timestamp': _now(),
        'branched_to': fail_branch_id,  # null unless a branch was triggered
    }

    new = deepcopy(state)
    new['decision_history'] = [*state['decision_history'], record]
    new['last_action_at'] = _now()
    new['suggestions'] = {}

    branched = False

    if is_correct:
        # Correct answer — advance normally
        next_stage_id = option.get('nextStageId')
        new['completed_stage_ids'] = list(state.get('completed_stage_ids', [])) + [stage_id]
        if next_stage_id:
            new.update({'phase': 'deciding', 'current_stage_id': next_stage_id})
            game_over = False
        else:
            new.update({'phase': 'complete', 'outcome': 'complete', 'completed_at': _now()})
            game_over = True

    elif fail_branch_id:
        # Wrong + branch defined — jump to consequence stage, don't decrement
        branched = True
        branch_stage = _find_stage(decision_tree, fail_branch_id)
        if not branch_stage:
            raise ValueError(f"failBranchStageId '{fail_branch_id}' not found in decision tree")
        # Mark current stage as completed (via wrong path) so timeline fills in
        new['completed_stage_ids'] = list(state.get('completed_stage_ids', [])) + [stage_id]
        # Track which stages were bypassed via branching
        branched_from = list(state.get('branched_from', []))
        # Record IDs of stages skipped (stages between current and branch target)
        branched_from.append({'from_stage': stage_id, 'to_branch': fail_branch_id})
        new['branched_from'] = branched_from
        new.update({'phase': 'deciding', 'current_stage_id': fail_branch_id})
        next_stage_id = fail_branch_id
        game_over = False

    else:
        # Wrong answer, no branch — decrement attempts
        new['attempts_remaining'] = state['attempts_remaining'] - 1
        if new['attempts_remaining'] <= 0:
            new.update({'phase': 'failed', 'outcome': 'failed', 'completed_at': _now()})
            next_stage_id, game_over = None, True
        else:
            next_stage_id, game_over = None, False
            new['phase'] = 'deciding'

    return new, {
        'type': 'choice_result', 'is_correct': is_correct,
        'attempts_remaining': new['attempts_remaining'],
        'consequence': option.get('consequence', ''),
        'technical_explanation': option.get('technicalExplanation', ''),
        'action_text': option.get('actionText', ''),
        'next_stage_id': next_stage_id, 'phase': new['phase'],
        'game_over': game_over, 'outcome': new.get('outcome'),
        'decision_record': record,
        'branched': branched, 'branch_stage_id': fail_branch_id,
    }


def use_hint(state: dict[str, Any], client_id: str, scenario_structure: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    if state.get('hints_used', {}).get(client_id):
        raise ValueError('Hint already used for this session')
    role = get_role(state, client_id)
    hints = scenario_structure.get('roleHints', {})
    hint = hints.get(role) or hints.get('solo') or 'No hint available for your role.'
    new = deepcopy(state)
    new.setdefault('hints_used', {})[client_id] = True
    return new, {'type': 'hint', 'client_id': client_id, 'role': role, 'hint': hint}


def session_summary(state: dict[str, Any]) -> dict[str, Any]:
    history = state.get('decision_history', [])
    correct = sum(1 for d in history if d.get('is_correct'))
    return {
        'session_id': state['session_id'], 'scenario_id': state['scenario_id'],
        'outcome': state.get('outcome'), 'phases_completed': list(state.get('completed_stage_ids', [])),
        'correct_choices': correct, 'wrong_choices': len(history) - correct,
        'attempts_used': state['max_attempts'] - state['attempts_remaining'],
        'started_at': state.get('started_at'), 'completed_at': state.get('completed_at'),
        'roles': state.get('roles', {}), 'role_names': state.get('role_names', {}),
    }


# ── Spectator management ──────────────────────────────────────────────────────

def add_spectator(
    state:     dict[str, Any],
    client_id: str,
    name:      str,
) -> dict[str, Any]:
    """Register a spectator. Spectators never count toward roles or attempts."""
    new = deepcopy(state)
    spectators = new.setdefault('spectators', {})
    spectators[client_id] = {'name': name, 'joined_at': _now()}
    return new


def remove_spectator(state: dict[str, Any], client_id: str) -> dict[str, Any]:
    new = deepcopy(state)
    new.setdefault('spectators', {}).pop(client_id, None)
    return new


def is_spectator(state: dict[str, Any], client_id: str) -> bool:
    return client_id in state.get('spectators', {})


def get_spectators(state: dict[str, Any]) -> dict[str, Any]:
    return state.get('spectators', {})
