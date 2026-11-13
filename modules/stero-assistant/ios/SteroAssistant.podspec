Pod::Spec.new do |s|
  s.name           = 'SteroAssistant'
  s.version        = '0.1.0'
  s.summary        = 'Stero Wrist assistant activation (iOS stub)'
  s.description    = 'iOS stub — watch / default-assistant are Android-first'
  s.license        = 'MIT'
  s.author         = 'Stero'
  s.homepage       = 'https://github.com/sterowrist/stero-wrist'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/sterowrist/stero-wrist.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
