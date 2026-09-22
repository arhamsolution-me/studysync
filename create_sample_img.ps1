Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 400, 200
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::DarkBlue)
$fontTitle = New-Object System.Drawing.Font('Arial', 14, [System.Drawing.FontStyle]::Bold)
$fontBody = New-Object System.Drawing.Font('Arial', 11)
$g.DrawString('Gradient Descent Algorithm', $fontTitle, $brush, 20, 20)
$bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
$g.DrawString('Formula: w = w - alpha * (dJ/dw)', $fontBody, $bodyBrush, 20, 60)
$g.DrawString('alpha = Learning Rate = 0.01', $fontBody, $bodyBrush, 20, 95)
$g.DrawString('dJ/dw = Cost function gradient', $fontBody, $bodyBrush, 20, 130)
$g.DrawString('Goal: Minimize Loss Function J(w)', $fontBody, $bodyBrush, 20, 160)
$bmp.Save('d:\MYtaskAgent\gradient_descent_diagram.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host 'Created sample study diagram'
