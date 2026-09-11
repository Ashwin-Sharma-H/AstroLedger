import re
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional

def normalize_phone(phone: Optional[str]) -> str:
    """
    Extracts the base digits from a phone number, returning the last 10 digits
    to match across different country codes or formatting conventions.
    """
    if not phone:
        return ""
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) >= 10:
        return digits[-10:]
    return digits

def clean_astrology_term(term: Optional[str]) -> str:
    """
    Strips script notes in parentheses like 'Aswathy (അശ്വതി)' -> 'aswathy'
    for clean canonical comparisons.
    """
    if not term:
        return ""
    return term.split('(')[0].strip().lower()

def compute_name_similarity(name1: str, name2: str) -> float:
    """
    Computes a composite similarity ratio (0.0 to 1.0) using SequenceMatcher
    and token-level set matching for rearranged names.
    """
    n1 = name1.strip().lower()
    n2 = name2.strip().lower()
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 1.0

    # 1. Sequence matcher direct ratio
    seq_ratio = SequenceMatcher(None, n1, n2).ratio()

    # 2. Token set comparison (e.g. 'Anand Kumar' vs 'Kumar Anand')
    tokens1 = set(n1.split())
    tokens2 = set(n2.split())
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    token_ratio = len(intersection) / len(union) if union else 0.0

    # 3. Token containment (e.g. 'Rahul' vs 'Rahul Varma')
    containment_ratio = 0.0
    if tokens1 and tokens2:
        min_tokens = min(len(tokens1), len(tokens2))
        if min_tokens > 0:
            containment_ratio = (len(intersection) / min_tokens) * 0.85

    return max(seq_ratio, token_ratio, containment_ratio)

def detect_client_duplicates(
    candidate_data: Dict[str, Any],
    existing_clients: List[Any],
    exclude_id: Optional[str] = None,
    min_confidence_threshold: int = 40
) -> List[Dict[str, Any]]:
    """
    Evaluates a candidate client payload against a list of existing client model instances.
    Returns a sorted list of potential matches with confidence score, confidence level,
    matched fields, and human-readable match reasons.
    """
    matches = []

    c_name = (candidate_data.get('name') or '').strip()
    c_phone_norm = normalize_phone(candidate_data.get('phone'))
    c_alt_phone_norm = normalize_phone(candidate_data.get('alternate_phone'))
    c_dob = str(candidate_data.get('dob') or '').strip()
    c_birth_time = str(candidate_data.get('birth_time') or '').strip()[:5]
    c_birth_place = (candidate_data.get('birth_place') or '').strip().lower()
    c_birth_star = clean_astrology_term(candidate_data.get('birth_star'))
    c_rashi = clean_astrology_term(candidate_data.get('rashi'))

    for client in existing_clients:
        if exclude_id and str(client.id) == str(exclude_id):
            continue

        score = 0
        matched_fields = []
        match_reasons = []

        ex_name = (client.name or '').strip()
        ex_phone_norm = normalize_phone(client.phone)
        ex_alt_phone_norm = normalize_phone(client.alternate_phone)
        ex_dob = str(client.dob or '').strip()
        ex_birth_time = str(client.birth_time or '').strip()[:5]
        ex_birth_place = (client.birth_place or '').strip().lower()
        ex_birth_star = clean_astrology_term(client.birth_star)
        ex_rashi = clean_astrology_term(client.rashi)

        # 1. Phone Comparison (Very high signal)
        phone_matched = False
        if c_phone_norm:
            if c_phone_norm == ex_phone_norm:
                score += 60
                matched_fields.append('phone')
                match_reasons.append(f"Identical primary phone ({client.phone})")
                phone_matched = True
            elif c_phone_norm == ex_alt_phone_norm:
                score += 50
                matched_fields.append('phone')
                match_reasons.append(f"Phone matches alternate contact ({client.alternate_phone})")
                phone_matched = True

        if c_alt_phone_norm and not phone_matched:
            if c_alt_phone_norm == ex_phone_norm or c_alt_phone_norm == ex_alt_phone_norm:
                score += 45
                matched_fields.append('alternate_phone')
                match_reasons.append("Alternate phone number matches")
                phone_matched = True

        # 2. Name Similarity
        name_sim = 0.0
        if c_name and ex_name:
            name_sim = compute_name_similarity(c_name, ex_name)
            if name_sim >= 0.95:
                score += 40
                matched_fields.append('name')
                match_reasons.append(f"Exact name match: '{client.name}'")
            elif name_sim >= 0.82:
                score += 30
                matched_fields.append('name')
                match_reasons.append(f"High name phonetic similarity ({int(name_sim * 100)}%) with '{client.name}'")
            elif name_sim >= 0.65:
                score += 18
                matched_fields.append('name')
                match_reasons.append(f"Moderate name similarity ({int(name_sim * 100)}%) with '{client.name}'")

        # 3. Date of Birth Match
        dob_matched = False
        if c_dob and ex_dob and c_dob == ex_dob:
            score += 25
            matched_fields.append('dob')
            match_reasons.append(f"Identical Date of Birth: {ex_dob}")
            dob_matched = True

        # 4. Birth Star / Nakshatra Match
        star_matched = False
        if c_birth_star and ex_birth_star and (c_birth_star in ex_birth_star or ex_birth_star in c_birth_star):
            score += 15
            matched_fields.append('birth_star')
            match_reasons.append(f"Identical Nakshatra: {client.birth_star}")
            star_matched = True

        # 5. Birth Place Match
        if c_birth_place and ex_birth_place and (c_birth_place in ex_birth_place or ex_birth_place in c_birth_place):
            score += 10
            matched_fields.append('birth_place')
            match_reasons.append(f"Matching birth city/place: {client.birth_place}")

        # 6. Rashi Match
        if c_rashi and ex_rashi and (c_rashi in ex_rashi or ex_rashi in c_rashi):
            score += 8
            matched_fields.append('rashi')

        # 7. Birth Time Match (within approximate hour/minute)
        if c_birth_time and ex_birth_time and c_birth_time == ex_birth_time:
            score += 10
            matched_fields.append('birth_time')
            match_reasons.append(f"Identical birth time: {ex_birth_time}")

        # Compound Bonuses
        if phone_matched and name_sim >= 0.70:
            score += 20
        if name_sim >= 0.80 and dob_matched:
            score += 25
        if dob_matched and star_matched:
            score += 15

        # Normalize score to 100 max
        final_score = min(100, score)

        if final_score >= min_confidence_threshold:
            if final_score >= 80:
                confidence_level = 'HIGH'
            elif final_score >= 55:
                confidence_level = 'MEDIUM'
            else:
                confidence_level = 'LOW'

            matches.append({
                'client': client,
                'confidence_score': final_score,
                'confidence_level': confidence_level,
                'matched_fields': list(set(matched_fields)),
                'match_reasons': match_reasons
            })

    # Sort matches descending by confidence score
    matches.sort(key=lambda m: m['confidence_score'], reverse=True)
    return matches
