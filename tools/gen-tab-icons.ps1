Add-Type -AssemblyName System.Drawing
$root = "c:/Users/d/love-miniapp/miniprogram/assets/tab"
$defs = @(
  @{ name="home";    glyph="home" },
  @{ name="checkin"; glyph="check" },
  @{ name="chat";    glyph="chat" },
  @{ name="calendar";glyph="cal" },
  @{ name="blog";    glyph="star" }
)
$colors = @{ gray="#9A7F82"; pink="#E86A7A" }

function New-Icon($glyph, $hex, $out) {
  $s = 162
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
  $pen = New-Object System.Drawing.Pen($c, 11)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = New-Object System.Drawing.SolidBrush($c)
  $pink = [System.Drawing.ColorTranslator]::FromHtml("#E86A7A")
  $pinkBrush = New-Object System.Drawing.SolidBrush($pink)
  $cx = $s/2; $cy = $s/2
  switch ($glyph) {
    "home" {
      $pts = @([System.Drawing.PointF]::new($cx-40,$cy+2),[System.Drawing.PointF]::new($cx,$cy-36),[System.Drawing.PointF]::new($cx+40,$cy+2))
      $g.DrawLines($pen, $pts)
      $g.DrawRectangle($pen, ($cx-27), ($cy+2), 54, 36)
    }
    "check" {
      $g.DrawEllipse($pen, ($cx-38), ($cy-38), 76, 76)
      $g.DrawLines($pen, @([System.Drawing.PointF]::new($cx-20,$cy+2),[System.Drawing.PointF]::new($cx-5,$cy+17),[System.Drawing.PointF]::new($cx+22,$cy-16)))
    }
    "chat" {
      $rect = New-Object System.Drawing.Rectangle(($cx-40), ($cy-34), 80, 58)
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $r = 18
      $path.AddArc($rect.X, $rect.Y, $r*2, $r*2, 180, 90)
      $path.AddArc($rect.Right-$r*2, $rect.Y, $r*2, $r*2, 270, 90)
      $path.AddArc($rect.Right-$r*2, $rect.Bottom-$r*2, $r*2, $r*2, 0, 90)
      $path.AddLine($rect.Right-30, $rect.Bottom, $rect.Right-38, $rect.Bottom+16)
      $path.AddLine($rect.Right-38, $rect.Bottom+16, $rect.Right-52, $rect.Bottom)
      $path.AddArc($rect.X, $rect.Bottom-$r*2, $r*2, $r*2, 90, 90)
      $path.CloseFigure()
      $g.DrawPath($pen, $path)
      $g.FillEllipse($pinkBrush, ($cx-14), ($cy-10), 12, 12)
      $g.FillEllipse($pinkBrush, ($cx+4), ($cy-10), 12, 12)
    }
    "cal" {
      $g.DrawRectangle($pen, ($cx-34), ($cy-26), 68, 60)
      $g.DrawLine($pen, ($cx-34), ($cy-6), ($cx+34), ($cy-6))
      $g.DrawLine($pen, ($cx-16), ($cy-40), ($cx-16), ($cy-22))
      $g.DrawLine($pen, ($cx+16), ($cy-40), ($cx+16), ($cy-22))
      $g.FillEllipse($pinkBrush, $cx-6, $cy+8, 12, 12)
    }
    "star" {
      $pts = @()
      for ($i=0; $i -lt 10; $i++) {
        $rr = if ($i % 2 -eq 0) { 38 } else { 17 }
        $a = -90 + $i*36
        $rad = $a * [Math]::PI / 180
        $pts += [System.Drawing.PointF]::new($cx + $rr*[Math]::Cos($rad), $cy + $rr*[Math]::Sin($rad))
      }
      $g.DrawPolygon($pen, $pts)
    }
  }
  $g.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

foreach ($d in $defs) {
  New-Icon $d.glyph $colors.gray  "$root/$($d.name).png"
  New-Icon $d.glyph $colors.pink  "$root/$($d.name)-active.png"
}
Write-Output "done"
