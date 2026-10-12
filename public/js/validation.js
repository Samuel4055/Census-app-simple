const VALID_SEX = new Set(['M', 'F']);

function validateStructure(payload) {
  const issues = [];
  const { headFullName, address, latitude, longitude, individuals } = payload;

  if (!headFullName || !headFullName.trim()) {
    issues.push({ ruleType: 'completeness', fieldName: 'headFullName', message: 'Head of household name is required' });
  }
  if (!address || !address.trim()) {
    issues.push({ ruleType: 'completeness', fieldName: 'address', message: 'Address is required' });
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    issues.push({ ruleType: 'completeness', fieldName: 'location', message: 'GPS location has not been captured yet' });
  }
  if (!Array.isArray(individuals) || individuals.length === 0) {
    issues.push({ ruleType: 'completeness', fieldName: 'individuals', message: 'At least one household member is required' });
  }

  (individuals || []).forEach((person, idx) => {
    if (!person.fullName || !person.fullName.trim()) {
      issues.push({ ruleType: 'completeness', fieldName: `individuals[${idx}].fullName`, message: `Member ${idx + 1}: name is required` });
    }
    const age = Number(person.age);
    if (person.age === '' || person.age === null || person.age === undefined || Number.isNaN(age) || age < 0 || age > 130) {
      issues.push({ ruleType: 'format_range', fieldName: `individuals[${idx}].age`, message: `Member ${idx + 1}: age must be between 0 and 130` });
    }
    if (!VALID_SEX.has(person.sex)) {
      issues.push({ ruleType: 'format_range', fieldName: `individuals[${idx}].sex`, message: `Member ${idx + 1}: sex must be M or F` });
    }
    if (!person.relationshipToHead || !person.relationshipToHead.trim()) {
      issues.push({ ruleType: 'completeness', fieldName: `individuals[${idx}].relationshipToHead`, message: `Member ${idx + 1}: relationship to head is required` });
    }
  });

  const heads = (individuals || []).filter((p) => (p.relationshipToHead || '').toLowerCase() === 'head');
  if (heads.length === 0) {
    issues.push({ ruleType: 'logical_consistency', fieldName: 'individuals', message: 'Exactly one member must be marked as Head (none found)' });
  } else if (heads.length > 1) {
    issues.push({ ruleType: 'logical_consistency', fieldName: 'individuals', message: 'Exactly one member must be marked as Head (more than one found)' });
  } else if (Number(heads[0].age) < 15) {
    issues.push({ ruleType: 'logical_consistency', fieldName: 'individuals', message: 'Declared Head is under the plausible minimum age (15)' });
  }

  return issues;
}

function findLocalDuplicate(payload, queuedRecords) {
  return queuedRecords.some(
    (record) =>
      record.clientUuid !== payload.clientUuid &&
      record.enumerationAreaId === payload.enumerationAreaId &&
      (record.headFullName || '').trim().toLowerCase() === (payload.headFullName || '').trim().toLowerCase()
  );
}
