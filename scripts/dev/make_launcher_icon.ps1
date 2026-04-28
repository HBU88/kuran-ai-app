Add-Type -AssemblyName PresentationCore,WindowsBase

function New-Brush([string]$hex) {
  return New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.ColorConverter]::ConvertFromString($hex))
}

function New-Pen([string]$hex, [double]$thickness) {
  $pen = New-Object System.Windows.Media.Pen((New-Brush $hex), $thickness)
  $pen.StartLineCap = 'Round'
  $pen.EndLineCap = 'Round'
  $pen.LineJoin = 'Round'
  return $pen
}

function Draw-BookIcon([bool]$transparent) {
  $vis = New-Object System.Windows.Media.DrawingVisual
  $dc = $vis.RenderOpen()
  if (-not $transparent) {
    $dc.DrawRectangle((New-Brush '#101A14'), $null, (New-Object System.Windows.Rect 0,0,1024,1024))
  }

  $darkPen = New-Pen '#101A14' 20
  $goldPen = New-Pen '#B7C8B2' 14
  $greenPen = New-Pen '#1DB954' 12
  $creamBrush = New-Brush '#F1F5F0'
  $greenBrush = New-Brush '#1DB954'

  $dc.DrawEllipse((New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromArgb(28,0,0,0))), $null, (New-Object System.Windows.Point 512, 748), 320, 70)

  $dc.DrawLine($darkPen, (New-Object System.Windows.Point 304, 786), (New-Object System.Windows.Point 442, 652))
  $dc.DrawLine($darkPen, (New-Object System.Windows.Point 720, 786), (New-Object System.Windows.Point 582, 652))
  $dc.DrawLine($goldPen, (New-Object System.Windows.Point 318, 772), (New-Object System.Windows.Point 456, 640))
  $dc.DrawLine($goldPen, (New-Object System.Windows.Point 706, 772), (New-Object System.Windows.Point 568, 640))
  $dc.DrawLine($greenPen, (New-Object System.Windows.Point 428, 640), (New-Object System.Windows.Point 596, 640))

  $leftPage = New-Object System.Windows.Media.PathGeometry
  $figL = New-Object System.Windows.Media.PathFigure
  $figL.StartPoint = (New-Object System.Windows.Point 512, 672)
  $figL.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 292, 684), $true)) | Out-Null
  $figL.Segments.Add((New-Object System.Windows.Media.QuadraticBezierSegment (New-Object System.Windows.Point 284, 506), (New-Object System.Windows.Point 344, 326), $true)) | Out-Null
  $figL.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 512, 400), $true)) | Out-Null
  $figL.IsClosed = $true
  $leftPage.Figures.Add($figL)

  $rightPage = New-Object System.Windows.Media.PathGeometry
  $figR = New-Object System.Windows.Media.PathFigure
  $figR.StartPoint = (New-Object System.Windows.Point 512, 672)
  $figR.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 732, 684), $true)) | Out-Null
  $figR.Segments.Add((New-Object System.Windows.Media.QuadraticBezierSegment (New-Object System.Windows.Point 740, 506), (New-Object System.Windows.Point 680, 326), $true)) | Out-Null
  $figR.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 512, 400), $true)) | Out-Null
  $figR.IsClosed = $true
  $rightPage.Figures.Add($figR)

  $leftCover = New-Object System.Windows.Media.PathGeometry
  $figCL = New-Object System.Windows.Media.PathFigure
  $figCL.StartPoint = (New-Object System.Windows.Point 344, 326)
  $figCL.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 512, 400), $true)) | Out-Null
  $figCL.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 512, 268), $true)) | Out-Null
  $figCL.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 354, 238), $true)) | Out-Null
  $figCL.IsClosed = $true
  $leftCover.Figures.Add($figCL)

  $rightCover = New-Object System.Windows.Media.PathGeometry
  $figCR = New-Object System.Windows.Media.PathFigure
  $figCR.StartPoint = (New-Object System.Windows.Point 680, 326)
  $figCR.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 512, 400), $true)) | Out-Null
  $figCR.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 512, 268), $true)) | Out-Null
  $figCR.Segments.Add((New-Object System.Windows.Media.LineSegment (New-Object System.Windows.Point 670, 238), $true)) | Out-Null
  $figCR.IsClosed = $true
  $rightCover.Figures.Add($figCR)

  $dc.DrawGeometry($creamBrush, $darkPen, $leftPage)
  $dc.DrawGeometry($creamBrush, $darkPen, $rightPage)
  $dc.DrawGeometry($greenBrush, $darkPen, $leftCover)
  $dc.DrawGeometry($greenBrush, $darkPen, $rightCover)
  $dc.DrawLine($darkPen, (New-Object System.Windows.Point 512, 268), (New-Object System.Windows.Point 512, 672))

  foreach ($y in @(360, 444, 528)) {
    $dc.DrawLine((New-Pen '#101A14' 9), (New-Object System.Windows.Point 360, $y), (New-Object System.Windows.Point 446, ($y + 18)))
    $dc.DrawLine((New-Pen '#101A14' 9), (New-Object System.Windows.Point 664, $y), (New-Object System.Windows.Point 578, ($y + 18)))
  }

  $dc.Close()
  $pf = [System.Windows.Media.PixelFormats]::Pbgra32
  $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(1024,1024,96,96,$pf)
  $bmp.Render($vis)
  return $bmp
}

$root = 'C:\kuran_app\assets\app'
foreach ($entry in @(
  @{ path = 'launcher_icon.png'; transparent = $false },
  @{ path = 'launcher_icon_foreground.png'; transparent = $true }
)) {
  $bmp = Draw-BookIcon $entry.transparent
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp)) | Out-Null
  $fs = [System.IO.File]::Create((Join-Path $root $entry.path))
  $enc.Save($fs)
  $fs.Close()
}

Write-Host 'launcher icon assets updated'
