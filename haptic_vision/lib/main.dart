import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() => runApp(const HapticVisionApp());

/// The only channel in the app. Everything that matters — the floating button,
/// the screen capture, the vision request and the vibration — lives in the
/// Android foreground service, because a Dart isolate is not guaranteed to be
/// alive while the user is in some other app.
const MethodChannel _channel = MethodChannel('haptic_vision/control');

class HapticVisionApp extends StatelessWidget {
  const HapticVisionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Haptic Vision',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F46E5),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const ControlScreen(),
    );
  }
}

class ControlScreen extends StatefulWidget {
  const ControlScreen({super.key});

  @override
  State<ControlScreen> createState() => _ControlScreenState();
}

class _ControlScreenState extends State<ControlScreen>
    with WidgetsBindingObserver {
  final bool _supported = Platform.isAndroid;
  bool _hasOverlay = false;
  bool _running = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // The overlay permission is granted in a system settings screen, so the
    // only reliable moment to re-check it is when we come back to the front.
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    if (!_supported) return;
    try {
      final overlay = await _channel.invokeMethod<bool>('hasOverlayPermission');
      final running = await _channel.invokeMethod<bool>('isRunning');
      if (!mounted) return;
      setState(() {
        _hasOverlay = overlay ?? false;
        _running = running ?? false;
        _error = null;
      });
    } on PlatformException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _call(String method) async {
    setState(() => _busy = true);
    try {
      await _channel.invokeMethod<void>(method);
      if (!mounted) return;
      setState(() => _error = null);
    } on PlatformException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message ?? e.code);
    } finally {
      if (mounted) setState(() => _busy = false);
      await _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: _supported ? _android(context) : _unsupported(context),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _android(BuildContext context) {
    return [
      const Icon(Icons.vibration, size: 56),
      const SizedBox(height: 16),
      Text(
        'Haptic Vision',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: 8),
      Text(
        'Tap the floating button in any app. It captures the screen, asks the '
        'vision model about it, and replies in vibrations.',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
      const SizedBox(height: 32),
      if (!_hasOverlay)
        FilledButton.icon(
          onPressed: _busy ? null : () => _call('requestOverlayPermission'),
          icon: const Icon(Icons.open_in_new),
          label: const Text('Allow display over other apps'),
        )
      else if (!_running)
        FilledButton.icon(
          onPressed: _busy ? null : () => _call('start'),
          icon: const Icon(Icons.play_arrow),
          label: const Text('Start floating button'),
        )
      else
        OutlinedButton.icon(
          onPressed: _busy ? null : () => _call('stop'),
          icon: const Icon(Icons.stop),
          label: const Text('Stop floating button'),
        ),
      if (_hasOverlay && !_running)
        const Padding(
          padding: EdgeInsets.only(top: 12),
          child: Text(
            'Android will ask you to share your screen. Choose "Entire screen".',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12),
          ),
        ),
      if (_error != null)
        Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
    ];
  }

  List<Widget> _unsupported(BuildContext context) {
    return [
      const Icon(Icons.block, size: 56),
      const SizedBox(height: 16),
      Text(
        'Android only',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: 8),
      Text(
        'iOS has no public API for a window that floats over other apps, and no '
        'way to capture the whole screen from the background. The pipeline '
        'cannot be built on this platform — see the README.',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    ];
  }
}
