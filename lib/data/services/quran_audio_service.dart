import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum QuranAudioPlaybackState { idle, loading, playing, error }

class QuranAudioService extends ChangeNotifier {
  static const MethodChannel _channel = MethodChannel('hakai/quran_audio');
  static const bool isAvailable = false;

  QuranAudioPlaybackState _state = QuranAudioPlaybackState.idle;
  String? _activeUrl;
  String? _errorMessage;

  QuranAudioPlaybackState get state => _state;
  String? get activeUrl => _activeUrl;
  String? get errorMessage => _errorMessage;
  bool get isLoading => _state == QuranAudioPlaybackState.loading;
  bool get isPlaying => _state == QuranAudioPlaybackState.playing;

  Future<void> playUrl(String url) async {
    if (!isAvailable) {
      _activeUrl = null;
      _errorMessage = 'Sesli dinleme yakında eklenecek.';
      _state = QuranAudioPlaybackState.idle;
      notifyListeners();
      return;
    }

    _activeUrl = url;
    _errorMessage = null;
    _state = QuranAudioPlaybackState.loading;
    notifyListeners();

    try {
      await _channel.invokeMethod<void>('playUrl', {'url': url});
      _activeUrl = url;
      _state = QuranAudioPlaybackState.playing;
      notifyListeners();
    } catch (error) {
      debugPrint('QURAN_AUDIO_PLAYBACK_ERROR $error');
      _activeUrl = null;
      _errorMessage = 'Ses şu anda oynatılamıyor.';
      _state = QuranAudioPlaybackState.error;
      notifyListeners();
    }
  }

  Future<void> stop() async {
    if (!isAvailable) {
      _activeUrl = null;
      _state = QuranAudioPlaybackState.idle;
      notifyListeners();
      return;
    }

    await _channel.invokeMethod<void>('stop');
    _activeUrl = null;
    _state = QuranAudioPlaybackState.idle;
    notifyListeners();
  }
}
