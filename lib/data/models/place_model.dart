class DiyanetCountry {
  const DiyanetCountry({
    required this.id,
    required this.name,
  });

  final int id;
  final String name;

  factory DiyanetCountry.fromJson(Map<String, dynamic> json) {
    return DiyanetCountry(
      id: _readId(json),
      name: json['name']?.toString() ?? '',
    );
  }
}

class DiyanetState {
  const DiyanetState({
    required this.id,
    required this.name,
  });

  final int id;
  final String name;

  factory DiyanetState.fromJson(Map<String, dynamic> json) {
    return DiyanetState(
      id: _readId(json),
      name: json['name']?.toString() ?? '',
    );
  }
}

class DiyanetCity {
  const DiyanetCity({
    required this.id,
    required this.name,
  });

  final int id;
  final String name;

  int get cityId => id;

  factory DiyanetCity.fromJson(Map<String, dynamic> json) {
    return DiyanetCity(
      id: _readId(json),
      name: json['name']?.toString() ?? '',
    );
  }
}

int _readId(Map<String, dynamic> json) {
  final rawId = json['id'] ?? json['cityId'] ?? json['cityID'];
  if (rawId is int) {
    return rawId;
  }
  return int.parse(rawId.toString());
}
